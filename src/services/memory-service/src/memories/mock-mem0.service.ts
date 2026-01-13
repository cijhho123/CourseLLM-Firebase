import { Injectable } from "@nestjs/common";
import { CustomLoggerService } from "../common/logger/logger.service";

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
export class MockMem0Service {
    private memories: Map<string, Mem0Memory[]> = new Map();
    private memoryIdCounter = 1;

    constructor(private readonly logger: CustomLoggerService) {
        this.logger.setContext("MockMem0Service");
        this.logger.info(
            "MockMem0Service initialized (using in-memory mock data)"
        );
    }

    async addMemories(
        messages: Mem0Message[],
        userId: string,
        metadata?: Record<string, any>
    ): Promise<Mem0Memory[]> {
        this.logger.info(
            `[MOCK] Adding memories for user ${userId} with ${messages.length} messages`
        );

        // Filter out system messages
        const filteredMessages = messages.filter(
            (msg) => msg.role !== "system"
        );

        if (filteredMessages.length === 0) {
            this.logger.warn(
                `No user/assistant messages found for user ${userId}, skipping memory creation`
            );
            return [];
        }

        // Generate mock memories from the conversation
        const newMemories: Mem0Memory[] = [];

        // Extract learning preferences and patterns from messages
        const userMessages = filteredMessages.filter(
            (msg) => msg.role === "user"
        );
        const assistantMessages = filteredMessages.filter(
            (msg) => msg.role === "assistant"
        );

        // Create memories based on conversation patterns
        if (userMessages.length > 0) {
            // Memory about learning preferences
            if (
                userMessages.some((msg) =>
                    msg.content.toLowerCase().includes("prefer")
                )
            ) {
                newMemories.push({
                    id: `mock_mem_${this.memoryIdCounter++}`,
                    memory: "User prefers visual explanations and practical examples",
                    user_id: userId,
                    metadata: { ...metadata, type: "learning_preference" },
                });
            }

            // Memory about topics discussed
            const topics = this.extractTopics(filteredMessages);
            if (topics.length > 0) {
                newMemories.push({
                    id: `mock_mem_${this.memoryIdCounter++}`,
                    memory: `User is studying: ${topics.join(", ")}`,
                    user_id: userId,
                    metadata: { ...metadata, type: "topic_interest" },
                });
            }

            // Memory about skill level
            if (
                userMessages.some(
                    (msg) =>
                        msg.content.toLowerCase().includes("struggle") ||
                        msg.content.toLowerCase().includes("difficult")
                )
            ) {
                newMemories.push({
                    id: `mock_mem_${this.memoryIdCounter++}`,
                    memory: "User shows areas for improvement and actively seeks help",
                    user_id: userId,
                    metadata: { ...metadata, type: "learning_pattern" },
                });
            } else if (
                userMessages.some(
                    (msg) =>
                        msg.content.toLowerCase().includes("understand") ||
                        msg.content.toLowerCase().includes("makes sense")
                )
            ) {
                newMemories.push({
                    id: `mock_mem_${this.memoryIdCounter++}`,
                    memory: "User demonstrates good comprehension and engagement",
                    user_id: userId,
                    metadata: { ...metadata, type: "learning_pattern" },
                });
            }
        }

        // If no specific patterns found, create a general memory
        if (newMemories.length === 0) {
            newMemories.push({
                id: `mock_mem_${this.memoryIdCounter++}`,
                memory: `User engaged in conversation about ${this.summarizeConversation(filteredMessages)}`,
                user_id: userId,
                metadata: { ...metadata, type: "general" },
            });
        }

        // Store memories
        const existingMemories = this.memories.get(userId) || [];
        this.memories.set(userId, [...existingMemories, ...newMemories]);

        this.logger.info(
            `[MOCK] Successfully created ${newMemories.length} memories for user ${userId}`
        );

        return newMemories;
    }

    async searchMemories(
        query: string,
        userId: string,
        limit: number = 10
    ): Promise<Mem0Memory[]> {
        this.logger.info(
            `[MOCK] Searching memories for user ${userId} with query: "${query}"`
        );

        const userMemories = this.memories.get(userId) || [];

        // Simple keyword matching
        const queryLower = query.toLowerCase();
        const matchedMemories = userMemories.filter((mem) =>
            mem.memory.toLowerCase().includes(queryLower)
        );

        const results = matchedMemories.slice(0, limit);

        this.logger.info(
            `[MOCK] Search returned ${results.length} results for user ${userId}`
        );

        return results;
    }

    async getAllMemories(userId: string): Promise<Mem0Memory[]> {
        this.logger.info(`[MOCK] Retrieving all memories for user ${userId}`);

        const memories = this.memories.get(userId) || [];

        this.logger.info(
            `[MOCK] Retrieved ${memories.length} memories for user ${userId}`
        );

        return memories;
    }

    // Helper methods
    private extractTopics(messages: Mem0Message[]): string[] {
        const topics = new Set<string>();
        const topicKeywords = {
            calculus: [
                "calculus",
                "derivative",
                "integral",
                "chain rule",
                "limit",
            ],
            algebra: [
                "algebra",
                "equation",
                "eigenvalue",
                "eigenvector",
                "matrix",
            ],
            programming: [
                "programming",
                "code",
                "function",
                "python",
                "javascript",
            ],
            physics: ["physics", "force", "energy", "motion", "velocity"],
            chemistry: ["chemistry", "molecule", "reaction", "atom", "element"],
        };

        const allText = messages.map((m) => m.content.toLowerCase()).join(" ");

        for (const [topic, keywords] of Object.entries(topicKeywords)) {
            if (keywords.some((keyword) => allText.includes(keyword))) {
                topics.add(topic);
            }
        }

        return Array.from(topics);
    }

    private summarizeConversation(messages: Mem0Message[]): string {
        const topics = this.extractTopics(messages);
        if (topics.length > 0) {
            return topics.join(" and ");
        }
        return "various topics";
    }

    // Helper method for testing
    clearMockData(): void {
        this.memories.clear();
        this.memoryIdCounter = 1;
    }

    getMockData(): Map<string, Mem0Memory[]> {
        return new Map(this.memories);
    }
}
