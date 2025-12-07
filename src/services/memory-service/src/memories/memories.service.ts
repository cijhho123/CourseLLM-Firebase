import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { Mem0Service } from "./mem0.service";
import { SynthesizeMemoriesDto } from "./dto/synthesize-memories.dto";
import { CustomLoggerService } from "../common/logger/logger.service";
import { IChatService, IUserService, IMemoryRepository } from "../common/interfaces";

@Injectable()
export class MemoriesService {
    constructor(
        @Inject("IChatService")
        private readonly chatService: IChatService,
        @Inject("IUserService")
        private readonly userService: IUserService,
        @Inject("IMemoryRepository")
        private readonly memoryRepository: IMemoryRepository,
        private readonly mem0Service: Mem0Service,
        private readonly logger: CustomLoggerService
    ) {
        this.logger.setContext("MemoriesService");
    }

    async synthesizeMemories(dto: SynthesizeMemoriesDto) {
        const startTime = Date.now();
        this.logger.info(
            `Starting memory synthesis for chat ${dto.chatID}${dto.query ? ` with query: ${dto.query}` : ""}`
        );

        try {
            // Get chat and verify it exists
            this.logger.info(`Fetching chat ${dto.chatID} from database`);
            const chat = await this.chatService.findChatWithMessages(
                dto.chatID
            );

            if (!chat) {
                this.logger.warn(`Chat ${dto.chatID} not found`);
                throw new NotFoundException(`Chat ${dto.chatID} not found`);
            }

            this.logger.info(
                `Retrieved chat ${dto.chatID} with ${chat.messages.length} messages for user ${chat.userId}`
            );

            if (chat.messages.length === 0) {
                this.logger.info(
                    `Chat ${dto.chatID} has no messages, skipping synthesis`
                );
                return {
                    success: true,
                    memoriesCreated: 0,
                    memories: [],
                };
            }

            // Convert messages to mem0.ai format
            const mem0Messages = chat.messages.map((msg) => ({
                role: msg.sender as "user" | "assistant" | "system",
                content: msg.content,
            }));
            this.logger.info(
                `Converted ${mem0Messages.length} messages to mem0 format`
            );

            // Call mem0.ai to synthesize memories
            const metadata = {
                chat_id: dto.chatID,
                query: dto.query,
                timestamp: new Date().toISOString(),
            };

            this.logger.info(`Calling mem0 service to synthesize memories`);
            const synthesizedMemories = await this.mem0Service.addMemories(
                mem0Messages,
                chat.userId,
                metadata
            );

            // Store memory metadata via repository
            this.logger.info(
                `Storing ${synthesizedMemories.length} memories in database`
            );
            const memoryRecords = await Promise.all(
                synthesizedMemories.map((mem) =>
                    this.memoryRepository.create({
                        userId: chat.userId,
                        content: mem.memory,
                        mem0MemoryId: mem.id,
                        sourceChatIds: [dto.chatID],
                    })
                )
            );

            const processingTime = Date.now() - startTime;
            this.logger.info(
                `Successfully synthesized ${memoryRecords.length} memories for chat ${dto.chatID} in ${processingTime}ms`
            );

            return {
                success: true,
                memoriesCreated: memoryRecords.length,
                memories: memoryRecords.map((m) => m.content),
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            const processingTime = Date.now() - startTime;
            this.logger.error(
                `Failed to synthesize memories for chat ${dto.chatID} after ${processingTime}ms: ${error.message}`,
                error.stack
            );
            return {
                success: false,
                memoriesCreated: 0,
                memories: [],
                error: error.message,
            };
        }
    }

    async getUserMemories(userId: string) {
        this.logger.info(`Retrieving memories for user ${userId}`);

        try {
            // Verify user exists
            this.logger.info(`Verifying user ${userId} exists`);
            const user = await this.userService.findUser(userId);

            if (!user) {
                this.logger.warn(`User ${userId} not found`);
                throw new NotFoundException(`User ${userId} not found`);
            }

            // Get memories via repository
            this.logger.info(
                `Fetching memories for user ${userId} from database`
            );
            let memories = await this.memoryRepository.findByUserId(userId);

            // If no local memories, try to sync from mem0.ai
            if (memories.length === 0) {
                this.logger.info(
                    `No local memories found for user ${userId}, checking mem0.ai...`
                );

                const mem0Memories = await this.mem0Service.getAllMemories(userId);

                if (mem0Memories.length > 0) {
                    this.logger.info(
                        `Found ${mem0Memories.length} memories in mem0.ai for user ${userId}, saving to database...`
                    );

                    // Save mem0 memories to local database
                    const savedMemories = await Promise.all(
                        mem0Memories.map((mem) =>
                            this.memoryRepository.create({
                                userId: userId,
                                content: mem.memory,
                                mem0MemoryId: mem.id,
                                sourceChatIds: [],
                            })
                        )
                    );

                    this.logger.info(
                        `Synced ${savedMemories.length} memories from mem0.ai to database for user ${userId}`
                    );

                    memories = savedMemories;
                } else {
                    this.logger.info(
                        `No memories found in mem0.ai for user ${userId}`
                    );
                }
            }

            this.logger.info(
                `Successfully retrieved ${memories.length} memories for user ${userId}`
            );

            return {
                memories: memories.map((mem) => ({
                    memoryID: mem.id,
                    content: mem.content,
                    createdAt: mem.createdAt.toISOString(),
                    relatedChats: mem.sourceChatIds,
                })),
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(
                `Failed to retrieve memories for user ${userId}: ${error.message}`,
                error.stack
            );
            throw new Error(`Failed to retrieve memories: ${error.message}`);
        }
    }
}
