import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CustomLoggerService } from "../../../common/logger/logger.service";
import { MemoryClient } from "mem0ai";

interface Mem0Message {
    role: "user" | "assistant" | "system";
    content: string;
}

interface Mem0Memory {
    id: string;
    memory: string;
    user_id: string;
    metadata?: Record<string, any>;
}

@Injectable()
export class Mem0Service {
    private readonly apiKey: string;
    private readonly client: MemoryClient;

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: CustomLoggerService
    ) {
        this.logger.setContext("Mem0Service");
        this.apiKey = this.configService.get<string>("MEM0_API_KEY");

        if (!this.apiKey) {
            this.logger.warn(
                "MEM0_API_KEY not configured, service will not function properly"
            );
        }

        // Initialize mem0.ai client
        this.client = new MemoryClient({ apiKey: this.apiKey });
        this.logger.info("Mem0Service initialized with mem0.ai client");
    }

    async addMemories(
        messages: Mem0Message[],
        userId: string,
        metadata?: Record<string, any>
    ): Promise<Mem0Memory[]> {
        this.logger.info(`Adding memories for user ${userId} with ${messages.length} messages`);
        this.logger.info(`Metadata: ${metadata ? JSON.stringify(metadata) : "none"}`);
    
        try {
            const filteredMessages = messages
                .filter((msg) => msg.role !== "system")
                .map((msg) => ({
                    role: msg.role as "user" | "assistant",
                    content: msg.content,
                }));
    
            if (filteredMessages.length === 0) return [];
    
            // Queue memories in mem0.ai (async)
            const response = await this.client.add(filteredMessages, { user_id: userId, metadata });
    
            this.logger.info(`Memory job queued for user ${userId}: ${JSON.stringify(response)}`);
    
            // Transform response minimally — no polling
            const memories: Mem0Memory[] = Array.isArray(response)
                ? response.map((item: any) => ({
                      id: item.id || item.memory_id,
                      memory: item.memory || item.text || item.content || "",
                      user_id: userId,
                      metadata: item.metadata || metadata,
                  }))
                : [];
    
            return memories;
        } catch (error) {
            this.logger.error(`Failed to add memories for user ${userId}: ${error.message}`, error.stack);
            throw new Error(`Failed to add memories: ${error.message}`);
        }
    }

    async searchMemories(
        query: string,
        userId: string,
        limit: number = 10
    ): Promise<Mem0Memory[]> {
        this.logger.info(
            `Searching memories for user ${userId} with query: "${query}" (limit: ${limit})`
        );

        try {
            // Call mem0.ai SDK to search memories
            const response = await this.client.search(query, {
                user_id: userId,
                limit,
            });

            this.logger.info(
                `Raw search response: ${JSON.stringify(response)}`
            );

            // Transform response to expected format
            const memories: Mem0Memory[] = Array.isArray(response)
                ? response.map((item: any) => ({
                      id: item.id || item.memory_id,
                      memory: item.memory || item.text || item.content,
                      user_id: userId,
                      metadata: item.metadata,
                  }))
                : [];

            this.logger.info(
                `Search returned ${memories.length} results for user ${userId}`
            );

            return memories;
        } catch (error) {
            this.logger.error(
                `Failed to search memories for user ${userId}: ${error.message}`,
                error.stack
            );
            throw new Error(`Failed to search memories: ${error.message}`);
        }
    }

    async getAllMemories(userId: string): Promise<Mem0Memory[]> {
        this.logger.info(`Retrieving all memories for user ${userId}`);

        try {
            // Call mem0.ai SDK to get all memories
            const response = await this.client.getAll({
                user_id: userId,
            });

            this.logger.info(
                `Raw getAll response: ${JSON.stringify(response)}`
            );

            // Transform response to expected format
            const memories: Mem0Memory[] = Array.isArray(response)
                ? response.map((item: any) => ({
                      id: item.id || item.memory_id,
                      memory: item.memory || item.text || item.content,
                      user_id: userId,
                      metadata: item.metadata,
                  }))
                : [];

            this.logger.info(
                `Retrieved ${memories.length} memories for user ${userId}`
            );

            return memories;
        } catch (error) {
            this.logger.error(
                `Failed to get all memories for user ${userId}: ${error.message}`,
                error.stack
            );
            throw new Error(`Failed to get memories: ${error.message}`);
        }
    }
}
