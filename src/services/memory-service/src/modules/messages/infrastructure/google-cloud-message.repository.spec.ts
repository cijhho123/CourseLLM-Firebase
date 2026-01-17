import { GoogleCloudMessageRepository } from "./google-cloud-message.repository";
import { CustomLoggerService } from "../../../common/logger/logger.service";
import { MessageRecord, CreateMessageData } from "../domain/message.types";

// Mock the dynamic imports and requires
jest.mock("@dataconnect/admin-generated", () => ({}), { virtual: true });

describe("GoogleCloudMessageRepository", () => {
  let repository: GoogleCloudMessageRepository;
  let mockLogger: jest.Mocked<CustomLoggerService>;
  let mockDataConnectModule: {
    createMessage: jest.Mock;
    getMessagesByChatId: jest.Mock;
  };

  const mockMessageRecord: MessageRecord = {
    id: "message-123",
    chatId: "chat-456",
    content: "Hello, world!",
    sender: "user",
    sequenceNumber: 1,
    createdAt: new Date("2024-01-15T10:00:00Z"),
    updatedAt: new Date("2024-01-15T10:00:00Z"),
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock logger
    mockLogger = {
      setContext: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<CustomLoggerService>;

    // Create mock Data Connect module
    mockDataConnectModule = {
      createMessage: jest.fn(),
      getMessagesByChatId: jest.fn(),
    };

    // Create repository instance
    repository = new GoogleCloudMessageRepository(mockLogger);

    // Inject the mock data connect module directly
    (repository as any).dataConnectModule = mockDataConnectModule;
  });

  describe("constructor", () => {
    it("should set the logger context", () => {
      expect(mockLogger.setContext).toHaveBeenCalledWith(
        "GoogleCloudMessageRepository"
      );
    });
  });

  describe("create", () => {
    const createMessageData: CreateMessageData = {
      chatId: "chat-456",
      content: "Hello, world!",
      sender: "user",
      sequenceNumber: 1,
    };

    it("should create a message and return the full record from findMessagesByChatId", async () => {
      mockDataConnectModule.createMessage.mockResolvedValue({
        data: {
          message_insert: { id: "message-123" },
        },
      });

      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-123",
              chatId: "chat-456",
              content: "Hello, world!",
              sender: "user",
              sequenceNumber: 1,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
          ],
        },
      });

      const result = await repository.create(createMessageData);

      expect(mockDataConnectModule.createMessage).toHaveBeenCalledWith({
        chatId: "chat-456",
        content: "Hello, world!",
        sender: "user",
        sequenceNumber: 1,
      });
      expect(result.id).toBe("message-123");
      expect(result.chatId).toBe("chat-456");
      expect(result.content).toBe("Hello, world!");
      expect(result.sender).toBe("user");
      expect(result.sequenceNumber).toBe(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Created message in chat chat-456"
      );
    });

    it("should return fallback record when message not found in findMessagesByChatId", async () => {
      const beforeTest = new Date();

      mockDataConnectModule.createMessage.mockResolvedValue({
        data: {
          message_insert: { id: "message-new" },
        },
      });

      // Return empty messages array - message not found
      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [],
        },
      });

      const result = await repository.create(createMessageData);

      const afterTest = new Date();

      expect(result.id).toBe("message-new");
      expect(result.chatId).toBe("chat-456");
      expect(result.content).toBe("Hello, world!");
      expect(result.sender).toBe("user");
      expect(result.sequenceNumber).toBe(1);
      expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeTest.getTime()
      );
      expect(result.createdAt.getTime()).toBeLessThanOrEqual(
        afterTest.getTime()
      );
    });

    it("should find the correct message by sequence number when multiple messages exist", async () => {
      mockDataConnectModule.createMessage.mockResolvedValue({
        data: {
          message_insert: { id: "message-3" },
        },
      });

      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-1",
              chatId: "chat-456",
              content: "First message",
              sender: "user",
              sequenceNumber: 1,
              createdAt: "2024-01-15T09:00:00Z",
              updatedAt: "2024-01-15T09:00:00Z",
            },
            {
              id: "message-2",
              chatId: "chat-456",
              content: "Second message",
              sender: "assistant",
              sequenceNumber: 2,
              createdAt: "2024-01-15T09:30:00Z",
              updatedAt: "2024-01-15T09:30:00Z",
            },
            {
              id: "message-3",
              chatId: "chat-456",
              content: "Third message",
              sender: "user",
              sequenceNumber: 3,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
          ],
        },
      });

      const result = await repository.create({
        chatId: "chat-456",
        content: "Third message",
        sender: "user",
        sequenceNumber: 3,
      });

      expect(result.id).toBe("message-3");
      expect(result.sequenceNumber).toBe(3);
      expect(result.content).toBe("Third message");
    });

    it("should handle assistant sender", async () => {
      mockDataConnectModule.createMessage.mockResolvedValue({
        data: {
          message_insert: { id: "message-assistant" },
        },
      });

      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-assistant",
              chatId: "chat-456",
              content: "I am an AI assistant",
              sender: "assistant",
              sequenceNumber: 2,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
          ],
        },
      });

      const result = await repository.create({
        chatId: "chat-456",
        content: "I am an AI assistant",
        sender: "assistant",
        sequenceNumber: 2,
      });

      expect(mockDataConnectModule.createMessage).toHaveBeenCalledWith({
        chatId: "chat-456",
        content: "I am an AI assistant",
        sender: "assistant",
        sequenceNumber: 2,
      });
      expect(result.sender).toBe("assistant");
    });

    it("should log and rethrow errors on creation failure", async () => {
      const error = new Error("Database connection failed");
      mockDataConnectModule.createMessage.mockRejectedValue(error);

      await expect(repository.create(createMessageData)).rejects.toThrow(
        "Database connection failed"
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to create message: Database connection failed",
        error.stack
      );
    });

    it("should handle empty content", async () => {
      mockDataConnectModule.createMessage.mockResolvedValue({
        data: {
          message_insert: { id: "message-empty" },
        },
      });

      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-empty",
              chatId: "chat-456",
              content: "",
              sender: "user",
              sequenceNumber: 1,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
          ],
        },
      });

      const result = await repository.create({
        chatId: "chat-456",
        content: "",
        sender: "user",
        sequenceNumber: 1,
      });

      expect(result.content).toBe("");
    });
  });

  describe("findMessagesByChatId", () => {
    it("should return all messages for a chat", async () => {
      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-1",
              chatId: "chat-456",
              content: "First message",
              sender: "user",
              sequenceNumber: 1,
              createdAt: "2024-01-15T09:00:00Z",
              updatedAt: "2024-01-15T09:00:00Z",
            },
            {
              id: "message-2",
              chatId: "chat-456",
              content: "Second message",
              sender: "assistant",
              sequenceNumber: 2,
              createdAt: "2024-01-15T09:30:00Z",
              updatedAt: "2024-01-15T09:30:00Z",
            },
          ],
        },
      });

      const result = await repository.findMessagesByChatId("chat-456");

      expect(mockDataConnectModule.getMessagesByChatId).toHaveBeenCalledWith({
        chatId: "chat-456",
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("message-1");
      expect(result[0].sender).toBe("user");
      expect(result[1].id).toBe("message-2");
      expect(result[1].sender).toBe("assistant");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Retrieved 2 messages for chat chat-456"
      );
    });

    it("should return empty array when chat has no messages", async () => {
      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [],
        },
      });

      const result = await repository.findMessagesByChatId("chat-empty");

      expect(result).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Retrieved 0 messages for chat chat-empty"
      );
    });

    it("should handle string timestamps", async () => {
      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-1",
              chatId: "chat-456",
              content: "Test",
              sender: "user",
              sequenceNumber: 1,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:30:00Z",
            },
          ],
        },
      });

      const result = await repository.findMessagesByChatId("chat-456");

      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[0].updatedAt).toBeInstanceOf(Date);
      expect(result[0].createdAt.toISOString()).toBe("2024-01-15T10:00:00.000Z");
      expect(result[0].updatedAt.toISOString()).toBe("2024-01-15T10:30:00.000Z");
    });

    it("should handle Date object timestamps", async () => {
      const createdDate = new Date("2024-01-15T10:00:00Z");
      const updatedDate = new Date("2024-01-15T10:30:00Z");

      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-1",
              chatId: "chat-456",
              content: "Test",
              sender: "user",
              sequenceNumber: 1,
              createdAt: createdDate,
              updatedAt: updatedDate,
            },
          ],
        },
      });

      const result = await repository.findMessagesByChatId("chat-456");

      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[0].updatedAt).toBeInstanceOf(Date);
    });

    it("should use current date when timestamps are missing", async () => {
      const beforeTest = new Date();

      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-1",
              chatId: "chat-456",
              content: "Test",
              sender: "user",
              sequenceNumber: 1,
              createdAt: null,
              updatedAt: null,
            },
          ],
        },
      });

      const result = await repository.findMessagesByChatId("chat-456");
      const afterTest = new Date();

      expect(result[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeTest.getTime()
      );
      expect(result[0].createdAt.getTime()).toBeLessThanOrEqual(
        afterTest.getTime()
      );
      expect(result[0].updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeTest.getTime()
      );
      expect(result[0].updatedAt.getTime()).toBeLessThanOrEqual(
        afterTest.getTime()
      );
    });

    it("should log and rethrow errors", async () => {
      const error = new Error("Query failed");
      mockDataConnectModule.getMessagesByChatId.mockRejectedValue(error);

      await expect(
        repository.findMessagesByChatId("chat-456")
      ).rejects.toThrow("Query failed");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to find messages: Query failed",
        error.stack
      );
    });

    it("should map all message properties correctly", async () => {
      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "msg-unique-id",
              chatId: "chat-specific",
              content: "Specific content with special chars: <>&\"'",
              sender: "user",
              sequenceNumber: 42,
              createdAt: "2024-06-20T15:30:00Z",
              updatedAt: "2024-06-20T16:00:00Z",
            },
          ],
        },
      });

      const result = await repository.findMessagesByChatId("chat-specific");

      expect(result[0]).toEqual({
        id: "msg-unique-id",
        chatId: "chat-specific",
        content: "Specific content with special chars: <>&\"'",
        sender: "user",
        sequenceNumber: 42,
        createdAt: new Date("2024-06-20T15:30:00Z"),
        updatedAt: new Date("2024-06-20T16:00:00Z"),
      });
    });
  });

  describe("getNextSequenceNumber", () => {
    it("should return 1 when chat has no messages", async () => {
      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [],
        },
      });

      const result = await repository.getNextSequenceNumber("chat-empty");

      expect(result).toBe(1);
    });

    it("should return next sequence number based on highest existing", async () => {
      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-1",
              chatId: "chat-456",
              content: "First",
              sender: "user",
              sequenceNumber: 1,
              createdAt: "2024-01-15T09:00:00Z",
              updatedAt: "2024-01-15T09:00:00Z",
            },
            {
              id: "message-2",
              chatId: "chat-456",
              content: "Second",
              sender: "assistant",
              sequenceNumber: 2,
              createdAt: "2024-01-15T09:30:00Z",
              updatedAt: "2024-01-15T09:30:00Z",
            },
            {
              id: "message-3",
              chatId: "chat-456",
              content: "Third",
              sender: "user",
              sequenceNumber: 3,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
          ],
        },
      });

      const result = await repository.getNextSequenceNumber("chat-456");

      expect(result).toBe(4);
    });

    it("should handle non-sequential sequence numbers", async () => {
      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-1",
              chatId: "chat-456",
              content: "First",
              sender: "user",
              sequenceNumber: 1,
              createdAt: "2024-01-15T09:00:00Z",
              updatedAt: "2024-01-15T09:00:00Z",
            },
            {
              id: "message-2",
              chatId: "chat-456",
              content: "Second",
              sender: "assistant",
              sequenceNumber: 5,
              createdAt: "2024-01-15T09:30:00Z",
              updatedAt: "2024-01-15T09:30:00Z",
            },
            {
              id: "message-3",
              chatId: "chat-456",
              content: "Third",
              sender: "user",
              sequenceNumber: 10,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
          ],
        },
      });

      const result = await repository.getNextSequenceNumber("chat-456");

      expect(result).toBe(11);
    });

    it("should handle single message in chat", async () => {
      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-1",
              chatId: "chat-456",
              content: "Only message",
              sender: "user",
              sequenceNumber: 1,
              createdAt: "2024-01-15T09:00:00Z",
              updatedAt: "2024-01-15T09:00:00Z",
            },
          ],
        },
      });

      const result = await repository.getNextSequenceNumber("chat-456");

      expect(result).toBe(2);
    });

    it("should log and rethrow errors", async () => {
      const error = new Error("Database error");
      mockDataConnectModule.getMessagesByChatId.mockRejectedValue(error);

      await expect(
        repository.getNextSequenceNumber("chat-456")
      ).rejects.toThrow("Database error");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to get next sequence number: Database error",
        error.stack
      );
    });

    it("should handle large sequence numbers", async () => {
      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-1",
              chatId: "chat-456",
              content: "Message",
              sender: "user",
              sequenceNumber: 999999,
              createdAt: "2024-01-15T09:00:00Z",
              updatedAt: "2024-01-15T09:00:00Z",
            },
          ],
        },
      });

      const result = await repository.getNextSequenceNumber("chat-456");

      expect(result).toBe(1000000);
    });
  });

  describe("onModuleInit", () => {
    it("should initialize the repository properly", async () => {
      // Create a fresh repository for this test
      const freshRepository = new GoogleCloudMessageRepository(mockLogger);

      // Verify the repository is properly constructed
      expect(freshRepository).toBeDefined();
      expect(mockLogger.setContext).toHaveBeenCalledWith(
        "GoogleCloudMessageRepository"
      );
    });
  });

  describe("edge cases", () => {
    it("should handle very long message content", async () => {
      const longContent = "a".repeat(10000);

      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-long",
              chatId: "chat-456",
              content: longContent,
              sender: "user",
              sequenceNumber: 1,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
          ],
        },
      });

      const result = await repository.findMessagesByChatId("chat-456");

      expect(result[0].content).toBe(longContent);
      expect(result[0].content.length).toBe(10000);
    });

    it("should handle special characters in content", async () => {
      const specialContent =
        "Hello 🎉 <script>alert('xss')</script> & \"quotes\" 'apostrophe' \n\ttabs";

      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-special",
              chatId: "chat-456",
              content: specialContent,
              sender: "user",
              sequenceNumber: 1,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
          ],
        },
      });

      const result = await repository.findMessagesByChatId("chat-456");

      expect(result[0].content).toBe(specialContent);
    });

    it("should handle unicode content", async () => {
      const unicodeContent = "مرحبا 你好 こんにちは 안녕하세요 Привет";

      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-unicode",
              chatId: "chat-456",
              content: unicodeContent,
              sender: "user",
              sequenceNumber: 1,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
          ],
        },
      });

      const result = await repository.findMessagesByChatId("chat-456");

      expect(result[0].content).toBe(unicodeContent);
    });

    it("should handle messages with sequenceNumber 0", async () => {
      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-zero",
              chatId: "chat-456",
              content: "Zero sequence",
              sender: "system",
              sequenceNumber: 0,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
          ],
        },
      });

      const result = await repository.getNextSequenceNumber("chat-456");

      expect(result).toBe(1);
    });

    it("should handle negative sequence numbers gracefully", async () => {
      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-neg",
              chatId: "chat-456",
              content: "Negative sequence",
              sender: "system",
              sequenceNumber: -5,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
            {
              id: "message-pos",
              chatId: "chat-456",
              content: "Positive sequence",
              sender: "user",
              sequenceNumber: 3,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
          ],
        },
      });

      const result = await repository.getNextSequenceNumber("chat-456");

      expect(result).toBe(4);
    });

    it("should handle concurrent message retrieval", async () => {
      mockDataConnectModule.getMessagesByChatId.mockResolvedValue({
        data: {
          messages: [
            {
              id: "message-1",
              chatId: "chat-456",
              content: "Message 1",
              sender: "user",
              sequenceNumber: 1,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
          ],
        },
      });

      // Simulate concurrent calls
      const [result1, result2, result3] = await Promise.all([
        repository.findMessagesByChatId("chat-456"),
        repository.findMessagesByChatId("chat-456"),
        repository.findMessagesByChatId("chat-456"),
      ]);

      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1);
      expect(result3).toHaveLength(1);
      expect(mockDataConnectModule.getMessagesByChatId).toHaveBeenCalledTimes(3);
    });
  });

  describe("integration scenarios", () => {
    it("should support a typical chat flow: create multiple messages and get next sequence", async () => {
      // First message creation
      mockDataConnectModule.createMessage.mockResolvedValueOnce({
        data: { message_insert: { id: "msg-1" } },
      });
      mockDataConnectModule.getMessagesByChatId.mockResolvedValueOnce({
        data: {
          messages: [
            {
              id: "msg-1",
              chatId: "chat-flow",
              content: "User question",
              sender: "user",
              sequenceNumber: 1,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
          ],
        },
      });

      const msg1 = await repository.create({
        chatId: "chat-flow",
        content: "User question",
        sender: "user",
        sequenceNumber: 1,
      });

      expect(msg1.sequenceNumber).toBe(1);

      // Get next sequence number for assistant response
      mockDataConnectModule.getMessagesByChatId.mockResolvedValueOnce({
        data: {
          messages: [
            {
              id: "msg-1",
              chatId: "chat-flow",
              content: "User question",
              sender: "user",
              sequenceNumber: 1,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
          ],
        },
      });

      const nextSeq = await repository.getNextSequenceNumber("chat-flow");
      expect(nextSeq).toBe(2);

      // Second message creation (assistant response)
      mockDataConnectModule.createMessage.mockResolvedValueOnce({
        data: { message_insert: { id: "msg-2" } },
      });
      mockDataConnectModule.getMessagesByChatId.mockResolvedValueOnce({
        data: {
          messages: [
            {
              id: "msg-1",
              chatId: "chat-flow",
              content: "User question",
              sender: "user",
              sequenceNumber: 1,
              createdAt: "2024-01-15T10:00:00Z",
              updatedAt: "2024-01-15T10:00:00Z",
            },
            {
              id: "msg-2",
              chatId: "chat-flow",
              content: "Assistant response",
              sender: "assistant",
              sequenceNumber: 2,
              createdAt: "2024-01-15T10:01:00Z",
              updatedAt: "2024-01-15T10:01:00Z",
            },
          ],
        },
      });

      const msg2 = await repository.create({
        chatId: "chat-flow",
        content: "Assistant response",
        sender: "assistant",
        sequenceNumber: 2,
      });

      expect(msg2.sequenceNumber).toBe(2);
      expect(msg2.sender).toBe("assistant");
    });
  });
});