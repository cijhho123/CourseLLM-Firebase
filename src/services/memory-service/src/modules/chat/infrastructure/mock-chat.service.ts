import { Injectable } from "@nestjs/common";
import { IChatService } from "../domain/chat-service.interface";
import { ChatWithMessages, ChatRecord, CreateChatData } from "../domain/chat.types";

@Injectable()
export class MockChatService implements IChatService {
    private chats: Map<string, ChatWithMessages> = new Map();
    private chatRecords: Map<string, ChatRecord> = new Map();

    constructor() {
        // Initialize with hardcoded test data
        this.initializeMockData();
    }

    private initializeMockData(): void {
        const mockChats: ChatWithMessages[] = [
            {
                id: "chat_abc123",
                userId: "user_123",
                title: "Calculus Study Session",
                messages: [
                    {
                        content:
                            "Hi! I need help understanding the chain rule in calculus.",
                        sender: "user",
                    },
                    {
                        content:
                            "Of course! The chain rule is used when you have a composite function. Would you like me to explain it with an example?",
                        sender: "assistant",
                    },
                    {
                        content:
                            "Yes, please! I prefer visual explanations if possible.",
                        sender: "user",
                    },
                    {
                        content:
                            "Great! Let me show you with a visual breakdown. If we have f(g(x)), the chain rule states that the derivative is f'(g(x)) * g'(x).",
                        sender: "assistant",
                    },
                    {
                        content:
                            "That makes sense! Can we try some practice problems?",
                        sender: "user",
                    },
                    {
                        content:
                            "Absolutely! Let's start with finding the derivative of (3x² + 2)⁵.",
                        sender: "assistant",
                    },
                ],
            },
            {
                id: "chat_xyz789",
                userId: "user_123",
                title: "Python Programming Help",
                messages: [
                    {
                        content:
                            "I'm struggling with understanding list comprehensions in Python.",
                        sender: "user",
                    },
                    {
                        content:
                            "No problem! List comprehensions are a concise way to create lists. They follow the pattern: [expression for item in iterable if condition]",
                        sender: "assistant",
                    },
                    {
                        content: "Can you show me a practical example?",
                        sender: "user",
                    },
                    {
                        content:
                            "Sure! Instead of writing a for loop, you can write: squares = [x**2 for x in range(10)]",
                        sender: "assistant",
                    },
                ],
            },
            {
                id: "chat_def456",
                userId: "user_789",
                title: "Linear Algebra Discussion",
                messages: [
                    {
                        content:
                            "What's the difference between eigenvalues and eigenvectors?",
                        sender: "user",
                    },
                    {
                        content:
                            "Eigenvectors are special vectors that only get scaled (not rotated) when a linear transformation is applied. Eigenvalues are the scaling factors.",
                        sender: "assistant",
                    },
                    {
                        content: "How do I find them in practice?",
                        sender: "user",
                    },
                    {
                        content:
                            "You solve the characteristic equation det(A - λI) = 0 to find eigenvalues, then substitute back to find eigenvectors.",
                        sender: "assistant",
                    },
                ],
            },
        ];

        mockChats.forEach((chat) => {
            this.chats.set(chat.id, chat);
            const now = new Date();
            this.chatRecords.set(chat.id, {
                id: chat.id,
                userId: chat.userId,
                title: chat.title,
                lastUpdatedAt: now,
                createdAt: now,
                updatedAt: now,
            });
        });
    }

    async findChatWithMessages(
        chatId: string
    ): Promise<ChatWithMessages | null> {
        return this.chats.get(chatId) || null;
    }

    async findChatById(chatId: string): Promise<ChatRecord | null> {
        return this.chatRecords.get(chatId) || null;
    }

    async findChatsByUserId(userId: string, limit?: number): Promise<ChatRecord[]> {
        const chats = Array.from(this.chatRecords.values())
            .filter(chat => chat.userId === userId)
            .sort((a, b) => b.lastUpdatedAt.getTime() - a.lastUpdatedAt.getTime());
        
        return limit ? chats.slice(0, limit) : chats;
    }

    async createChat(data: CreateChatData): Promise<ChatRecord> {
        const now = new Date();
        const chatRecord: ChatRecord = {
            id: data.id,
            userId: data.userId,
            title: data.title || null,
            lastUpdatedAt: now,
            createdAt: now,
            updatedAt: now,
        };
        this.chatRecords.set(data.id, chatRecord);
        
        // Also create ChatWithMessages entry
        this.chats.set(data.id, {
            id: data.id,
            userId: data.userId,
            title: data.title || null,
            messages: [],
        });
        
        return chatRecord;
    }

    async updateChat(
        chatId: string,
        updates: { title?: string; lastUpdatedAt?: Date }
    ): Promise<ChatRecord> {
        const chat = this.chatRecords.get(chatId);
        if (!chat) {
            throw new Error(`Chat ${chatId} not found`);
        }
        
        const updated: ChatRecord = {
            ...chat,
            title: updates.title !== undefined ? updates.title : chat.title,
            lastUpdatedAt: updates.lastUpdatedAt || new Date(),
            updatedAt: new Date(),
        };
        
        this.chatRecords.set(chatId, updated);
        return updated;
    }
}
