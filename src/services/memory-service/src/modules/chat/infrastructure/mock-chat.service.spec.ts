import { Test, TestingModule } from "@nestjs/testing";
import { MockChatService } from "./mock-chat.service";
import { ChatWithMessages } from "../domain/chat.types";

describe("MockChatService", () => {
    let service: MockChatService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [MockChatService],
        }).compile();

        service = module.get<MockChatService>(MockChatService);
    });

    it("should be defined", () => {
        expect(service).toBeDefined();
    });

    describe("initialization", () => {
        it("should initialize with mock data on construction", () => {
            expect(service).toBeDefined();
            // Verify that the service has data by checking if we can retrieve a known chat
            const chat = service.findChatWithMessages("chat_abc123");
            expect(chat).toBeDefined();
        });
    });

    describe("findChatWithMessages", () => {
        it("should return a chat when given a valid chat ID", async () => {
            const chatId = "chat_abc123";
            const result = await service.findChatWithMessages(chatId);

            expect(result).not.toBeNull();
            expect(result?.id).toBe(chatId);
            expect(result?.userId).toBe("user_123");
            expect(result?.title).toBe("Calculus Study Session");
        });

        it("should return the correct chat with all messages for chat_abc123", async () => {
            const result = await service.findChatWithMessages("chat_abc123");

            expect(result).not.toBeNull();
            expect(result?.messages).toHaveLength(6);
            expect(result?.messages[0].content).toContain(
                "help understanding the chain rule"
            );
            expect(result?.messages[0].sender).toBe("user");
            expect(result?.messages[1].sender).toBe("assistant");
        });

        it("should return the correct chat with all messages for chat_xyz789", async () => {
            const result = await service.findChatWithMessages("chat_xyz789");

            expect(result).not.toBeNull();
            expect(result?.id).toBe("chat_xyz789");
            expect(result?.userId).toBe("user_123");
            expect(result?.title).toBe("Python Programming Help");
            expect(result?.messages).toHaveLength(4);
            expect(result?.messages[0].content).toContain(
                "list comprehensions in Python"
            );
        });

        it("should return the correct chat with all messages for chat_def456", async () => {
            const result = await service.findChatWithMessages("chat_def456");

            expect(result).not.toBeNull();
            expect(result?.id).toBe("chat_def456");
            expect(result?.userId).toBe("user_789");
            expect(result?.title).toBe("Linear Algebra Discussion");
            expect(result?.messages).toHaveLength(4);
            expect(result?.messages[0].content).toContain(
                "eigenvalues and eigenvectors"
            );
        });

        it("should return null when given an invalid chat ID", async () => {
            const invalidChatId = "chat_nonexistent";
            const result = await service.findChatWithMessages(invalidChatId);

            expect(result).toBeNull();
        });

        it("should return null for empty string chat ID", async () => {
            const result = await service.findChatWithMessages("");

            expect(result).toBeNull();
        });

        it("should return null for undefined chat ID", async () => {
            const result = await service.findChatWithMessages(
                undefined as any
            );

            expect(result).toBeNull();
        });
    });

    describe("message structure validation", () => {
        it("should have alternating user and assistant messages for chat_abc123", async () => {
            const result = await service.findChatWithMessages("chat_abc123");

            expect(result).not.toBeNull();
            const messages = result!.messages;

            expect(messages[0].sender).toBe("user");
            expect(messages[1].sender).toBe("assistant");
            expect(messages[2].sender).toBe("user");
            expect(messages[3].sender).toBe("assistant");
            expect(messages[4].sender).toBe("user");
            expect(messages[5].sender).toBe("assistant");
        });

        it("should ensure all messages have required properties", async () => {
            const result = await service.findChatWithMessages("chat_abc123");

            expect(result).not.toBeNull();
            result!.messages.forEach((message) => {
                expect(message).toHaveProperty("content");
                expect(message).toHaveProperty("sender");
                expect(message.content).toBeTruthy();
                expect(["user", "assistant"]).toContain(message.sender);
            });
        });
    });

    describe("data consistency", () => {
        it("should return the same data on multiple calls", async () => {
            const firstCall = await service.findChatWithMessages("chat_abc123");
            const secondCall = await service.findChatWithMessages("chat_abc123");

            expect(firstCall).toEqual(secondCall);
        });

        it("should maintain data integrity across different chat IDs", async () => {
            const chat1 = await service.findChatWithMessages("chat_abc123");
            const chat2 = await service.findChatWithMessages("chat_xyz789");
            const chat3 = await service.findChatWithMessages("chat_def456");

            expect(chat1?.id).not.toBe(chat2?.id);
            expect(chat2?.id).not.toBe(chat3?.id);
            expect(chat1?.id).not.toBe(chat3?.id);
        });

        it("should have chats with different user IDs", async () => {
            const chat1 = await service.findChatWithMessages("chat_abc123");
            const chat3 = await service.findChatWithMessages("chat_def456");

            expect(chat1?.userId).toBe("user_123");
            expect(chat3?.userId).toBe("user_789");
            expect(chat1?.userId).not.toBe(chat3?.userId);
        });
    });

    describe("edge cases", () => {
        it("should handle rapid consecutive calls", async () => {
            const promises = [
                service.findChatWithMessages("chat_abc123"),
                service.findChatWithMessages("chat_xyz789"),
                service.findChatWithMessages("chat_def456"),
                service.findChatWithMessages("chat_nonexistent"),
            ];

            const results = await Promise.all(promises);

            expect(results[0]).not.toBeNull();
            expect(results[1]).not.toBeNull();
            expect(results[2]).not.toBeNull();
            expect(results[3]).toBeNull();
        });

        it("should handle case-sensitive chat IDs", async () => {
            const result1 = await service.findChatWithMessages("chat_abc123");
            const result2 = await service.findChatWithMessages("CHAT_ABC123");

            expect(result1).not.toBeNull();
            expect(result2).toBeNull();
        });
    });

    describe("type checking", () => {
        it("should return ChatWithMessages type structure", async () => {
            const result = await service.findChatWithMessages("chat_abc123");

            expect(result).not.toBeNull();
            expect(result).toHaveProperty("id");
            expect(result).toHaveProperty("userId");
            expect(result).toHaveProperty("title");
            expect(result).toHaveProperty("messages");
            expect(Array.isArray(result?.messages)).toBe(true);
        });

        it("should have string type for all text properties", async () => {
            const result = await service.findChatWithMessages("chat_abc123");

            expect(result).not.toBeNull();
            expect(typeof result?.id).toBe("string");
            expect(typeof result?.userId).toBe("string");
            expect(typeof result?.title).toBe("string");
        });
    });
});