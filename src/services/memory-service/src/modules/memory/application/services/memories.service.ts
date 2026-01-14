import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { Mem0Service } from "../../infrastructure/mem0.service";
import { SynthesizeMemoriesDto } from "../dto/synthesize-memories.dto";
import { CustomLoggerService } from "../../../../common/logger/logger.service";
import { IMemoryRepository } from "../../domain/memory-repository.interface";
import { IChatService } from "../../../chat/domain/chat-service.interface";
import { IUserService } from "../../../user/domain/user-service.interface";

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

    /**
     * Fire-and-forget memory synthesis.
     * Queues a job in mem0 and immediately returns the event ID.
     */
    async synthesizeMemories(dto: SynthesizeMemoriesDto) {
        const startTime = Date.now();
        this.logger.info(
            `Queueing memory synthesis for chat ${dto.chatID}${dto.query ? ` with query: ${dto.query}` : ""}`
        );

        try {
            // Get chat and verify it exists
            this.logger.info(`Fetching chat ${dto.chatID} from database`);
            const chat = await this.chatService.findChatWithMessages(dto.chatID);

            if (!chat) {
                this.logger.warn(`Chat ${dto.chatID} not found`);
                throw new NotFoundException(`Chat ${dto.chatID} not found`);
            }

            if (chat.messages.length === 0) {
                this.logger.info(`Chat ${dto.chatID} has no messages, skipping synthesis`);
                return {
                    success: true,
                    message: "No messages to synthesize",
                    memoriesCreated: 0,
                    event_id: null,
                };
            }

            // Convert messages to mem0.ai format
            const mem0Messages = chat.messages.map((msg) => ({
                role: msg.sender as "user" | "assistant" | "system",
                content: msg.content,
            }));

            const metadata = {
                chat_id: dto.chatID,
                query: dto.query,
                timestamp: new Date().toISOString(),
            };

            this.logger.info(`Calling mem0 service to queue memory synthesis`);

            // Queue the job in mem0 (fire-and-forget)
            const response = await this.mem0Service.addMemories(mem0Messages, chat.userId, metadata);

            const processingTime = Date.now() - startTime;
            this.logger.info(
                `Memory synthesis queued for chat ${dto.chatID} in ${processingTime}ms. Event ID: ${response[0].id}`
            );

            return {
                success: true,
                message: "Memory synthesis queued",
                event_id: response[0].id,
                status: response[0].metadata.status,
            };
        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.logger.error(
                `Failed to queue memory synthesis for chat ${dto.chatID} after ${processingTime}ms: ${error.message}`,
                error.stack
            );
            return {
                success: false,
                message: "Failed to queue memory synthesis",
                error: error.message,
                event_id: null,
            };
        }
    }

    /**
     * Retrieve memories for a user (local DB + fallback to mem0.ai)
     */
    async getUserMemories(userId: string) {
        this.logger.info(`Retrieving memories for user ${userId}`);

        try {
            // Verify user exists
            const user = await this.userService.findUser(userId);
            if (!user) throw new NotFoundException(`User ${userId} not found`);

            // Fetch memories from local DB
            let memories = await this.memoryRepository.findByUserId(userId);

            // Fallback: fetch from mem0.ai if none locally
            if (memories.length === 0) {
                this.logger.info(`No local memories for user ${userId}, checking mem0.ai`);
                const mem0Memories = await this.mem0Service.getAllMemories(userId);

                if (mem0Memories.length > 0) {
                    const savedMemories = await Promise.all(
                        mem0Memories.map((mem) =>
                            this.memoryRepository.create({
                                userId,
                                content: mem.memory,
                                mem0MemoryId: mem.id,
                                sourceChatIds: [],
                            })
                        )
                    );
                    memories = savedMemories;
                    this.logger.info(`Synced ${savedMemories.length} memories from mem0.ai`);
                }
            }

            return {
                memories: memories.map((mem) => ({
                    memoryID: mem.id,
                    content: mem.content,
                    createdAt: mem.createdAt.toISOString(),
                    relatedChats: mem.sourceChatIds,
                })),
            };
        } catch (error) {
            this.logger.error(`Failed to retrieve memories for user ${userId}: ${error.message}`, error.stack);
            throw new Error(`Failed to retrieve memories: ${error.message}`);
        }
    }
}