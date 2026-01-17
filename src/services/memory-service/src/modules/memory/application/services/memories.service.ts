import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { Mem0Service } from "../../infrastructure/mem0.service";
import { SynthesizeMemoriesDto } from "../dto/synthesize-memories.dto";
import { CustomLoggerService } from "../../../../common/logger/logger.service";
import { IChatService } from "../../../chat/domain/chat-service.interface";
import { IUserService } from "../../../user/domain/user-service.interface";

@Injectable()
export class MemoriesService {
    constructor(
        @Inject("IChatService")
        private readonly chatService: IChatService,
        @Inject("IUserService")
        private readonly userService: IUserService,
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
            // Memories are stored in mem0.ai and retrieved directly from there when requested
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
     * Retrieve memories for a user directly from mem0.ai
     * No local database storage - mem0.ai is the single source of truth
     */
    async getUserMemories(userId: string) {
        this.logger.info(`Retrieving memories for user ${userId} from mem0.ai`);

        try {
            // Verify user exists
            const user = await this.userService.findUser(userId);
            if (!user) throw new NotFoundException(`User ${userId} not found`);

            // Fetch memories directly from mem0.ai
            const mem0Memories = await this.mem0Service.getAllMemories(userId);
            this.logger.info(`Retrieved ${mem0Memories.length} memories from mem0.ai for user ${userId}`);

            // Deduplicate by ID and content (in case mem0 returns duplicates)
            const seenIds = new Set<string>();
            const seenContent = new Set<string>();
            const uniqueMemories = mem0Memories.filter(mem => {
                if (!mem.id) {
                    this.logger.warn(`Skipping memory without ID from mem0.ai`);
                    return false;
                }
                
                const normalizedContent = mem.memory.trim().toLowerCase();
                
                // Skip if we've already seen this ID or content
                if (seenIds.has(mem.id)) {
                    this.logger.debug(`Duplicate memory ID ${mem.id} found, skipping`);
                    return false;
                }
                if (seenContent.has(normalizedContent)) {
                    this.logger.debug(`Duplicate memory content found (ID: ${mem.id}), skipping`);
                    return false;
                }
                
                seenIds.add(mem.id);
                seenContent.add(normalizedContent);
                return true;
            });

            this.logger.info(`Returning ${uniqueMemories.length} unique memories for user ${userId}`);

            // Transform mem0.ai response to expected format
            return {
                memories: uniqueMemories.map((mem) => ({
                    memoryID: mem.id,
                    content: mem.memory,
                    createdAt: mem.metadata?.timestamp 
                        ? new Date(mem.metadata.timestamp).toISOString()
                        : new Date().toISOString(), // Fallback to current time if no timestamp
                    relatedChats: mem.metadata?.chat_id 
                        ? (Array.isArray(mem.metadata.chat_id) 
                            ? mem.metadata.chat_id 
                            : [mem.metadata.chat_id])
                        : [],
                })),
            };
        } catch (error) {
            this.logger.error(`Failed to retrieve memories for user ${userId}: ${error.message}`, error.stack);
            throw new Error(`Failed to retrieve memories: ${error.message}`);
        }
    }
}