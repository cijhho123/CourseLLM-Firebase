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
            // Note: This only queues the job - memories are created asynchronously by mem0
            // They will be saved to the database when fetched via getUserMemories
            const response = await this.mem0Service.addMemories(mem0Messages, chat.userId, metadata);

            const processingTime = Date.now() - startTime;
            const eventId = response && response.length > 0 ? response[0]?.id : null;
            
            this.logger.info(
                `Memory synthesis queued for chat ${dto.chatID} in ${processingTime}ms. Event ID: ${eventId || 'N/A'}`
            );

            return {
                success: true,
                message: "Memory synthesis queued",
                event_id: eventId,
                status: "queued",
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
     * Retrieve memories for a user (local DB + sync from mem0.ai)
     * Memories are created in the database when fetched from mem0.ai
     */
    async getUserMemories(userId: string) {
        this.logger.info(`Retrieving memories for user ${userId}`);

        try {
            // Verify user exists
            const user = await this.userService.findUser(userId);
            if (!user) throw new NotFoundException(`User ${userId} not found`);

            // Fetch memories from local DB
            const localMemories = await this.memoryRepository.findByUserId(userId);
            const localMem0Ids = new Set(localMemories.map(m => m.mem0MemoryId).filter(Boolean));

            // Always check mem0.ai for any new memories that haven't been synced yet
            this.logger.info(`Checking mem0.ai for memories for user ${userId}`);
            const mem0Memories = await this.mem0Service.getAllMemories(userId);

            // Filter out memories that are already in local DB
            const newMem0Memories = mem0Memories.filter(mem => !localMem0Ids.has(mem.id));

            // Save any new memories from mem0.ai to local database
            if (newMem0Memories.length > 0) {
                this.logger.info(`Found ${newMem0Memories.length} new memories from mem0.ai, saving to database`);
                try {
                    const savedMemories = await Promise.all(
                        newMem0Memories.map((mem) =>
                            this.memoryRepository.create({
                                userId,
                                content: mem.memory,
                                mem0MemoryId: mem.id,
                                sourceChatIds: mem.metadata?.chat_id 
                                    ? (Array.isArray(mem.metadata.chat_id) 
                                        ? mem.metadata.chat_id 
                                        : [mem.metadata.chat_id])
                                    : [],
                            })
                        )
                    );
                    this.logger.info(`Synced ${savedMemories.length} new memories from mem0.ai to database`);
                    
                    // Add newly saved memories to the local memories list
                    localMemories.push(...savedMemories.map((mem) => ({
                        id: mem.id,
                        content: mem.content,
                        createdAt: mem.createdAt,
                        sourceChatIds: mem.sourceChatIds,
                    })));
                } catch (saveError) {
                    this.logger.warn(`Failed to save some memories from mem0.ai: ${saveError.message}`);
                }
            }

            return {
                memories: localMemories.map((mem) => ({
                    memoryID: mem.id,
                    content: mem.content,
                    createdAt: mem.createdAt.toISOString(),
                    relatedChats: mem.sourceChatIds || [],
                })),
            };
        } catch (error) {
            this.logger.error(`Failed to retrieve memories for user ${userId}: ${error.message}`, error.stack);
            throw new Error(`Failed to retrieve memories: ${error.message}`);
        }
    }
}