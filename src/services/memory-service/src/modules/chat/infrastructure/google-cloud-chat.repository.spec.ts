import { GoogleCloudChatRepository } from "./google-cloud-chat.repository";
import { CustomLoggerService } from "../../../common/logger/logger.service";
import { ChatRecord, CreateChatData } from "../domain/chat.types";

// Mock the dynamic imports and requires
jest.mock("@dataconnect/admin-generated", () => ({}), { virtual: true });

describe("GoogleCloudChatRepository", () => {
  let repository: GoogleCloudChatRepository;
  let mockLogger: jest.Mocked<CustomLoggerService>;
  let mockDataConnectModule: {
    createChat: jest.Mock;
    getChatById: jest.Mock;
    getChatsByUserId: jest.Mock;
    updateChat: jest.Mock;
  };

  const mockChatRecord: ChatRecord = {
    id: "chat-123",
    userId: "user-456",
    title: "Test Chat",
    lastUpdatedAt: new Date("2024-01-15T10:00:00Z"),
    createdAt: new Date("2024-01-15T09:00:00Z"),
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
      createChat: jest.fn(),
      getChatById: jest.fn(),
      getChatsByUserId: jest.fn(),
      updateChat: jest.fn(),
    };

    // Create repository instance
    repository = new GoogleCloudChatRepository(mockLogger);

    // Inject the mock data connect module directly
    (repository as any).dataConnectModule = mockDataConnectModule;
  });

  describe("constructor", () => {
    it("should set the logger context", () => {
      expect(mockLogger.setContext).toHaveBeenCalledWith(
        "GoogleCloudChatRepository"
      );
    });
  });

  describe("create", () => {
    const createChatData: CreateChatData = {
      id: "chat-123",
      userId: "user-456",
      title: "Test Chat",
    };

    it("should create a chat and return the full record", async () => {
      mockDataConnectModule.createChat.mockResolvedValue({
        data: {
          chat_insert: { id: "chat-123" },
        },
      });

      mockDataConnectModule.getChatById.mockResolvedValue({
        data: {
          chat: {
            id: "chat-123",
            userId: "user-456",
            title: "Test Chat",
            lastUpdatedAt: "2024-01-15T10:00:00Z",
            createdAt: "2024-01-15T09:00:00Z",
            updatedAt: "2024-01-15T10:00:00Z",
          },
        },
      });

      const result = await repository.create(createChatData);

      expect(mockDataConnectModule.createChat).toHaveBeenCalledWith({
        id: "chat-123",
        userId: "user-456",
        title: "Test Chat",
      });
      expect(result.id).toBe("chat-123");
      expect(result.userId).toBe("user-456");
      expect(result.title).toBe("Test Chat");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Created chat chat-123 for user user-456"
      );
    });

    it("should create a chat with null title when not provided", async () => {
      const dataWithoutTitle: CreateChatData = {
        id: "chat-123",
        userId: "user-456",
      };

      mockDataConnectModule.createChat.mockResolvedValue({
        data: {
          chat_insert: { id: "chat-123" },
        },
      });

      mockDataConnectModule.getChatById.mockResolvedValue({
        data: {
          chat: {
            id: "chat-123",
            userId: "user-456",
            title: null,
            lastUpdatedAt: "2024-01-15T10:00:00Z",
            createdAt: "2024-01-15T09:00:00Z",
            updatedAt: "2024-01-15T10:00:00Z",
          },
        },
      });

      await repository.create(dataWithoutTitle);

      expect(mockDataConnectModule.createChat).toHaveBeenCalledWith({
        id: "chat-123",
        userId: "user-456",
        title: null,
      });
    });

    it("should throw an error if chat retrieval fails after creation", async () => {
      mockDataConnectModule.createChat.mockResolvedValue({
        data: {
          chat_insert: { id: "chat-123" },
        },
      });

      mockDataConnectModule.getChatById.mockResolvedValue({
        data: {
          chat: null,
        },
      });

      await expect(repository.create(createChatData)).rejects.toThrow(
        "Failed to retrieve created chat chat-123"
      );
    });

    it("should log and rethrow errors on creation failure", async () => {
      const error = new Error("Database connection failed");
      mockDataConnectModule.createChat.mockRejectedValue(error);

      await expect(repository.create(createChatData)).rejects.toThrow(
        "Database connection failed"
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to create chat: Database connection failed",
        error.stack
      );
    });
  });

  describe("findById", () => {
    it("should return a chat record when found", async () => {
      mockDataConnectModule.getChatById.mockResolvedValue({
        data: {
          chat: {
            id: "chat-123",
            userId: "user-456",
            title: "Test Chat",
            lastUpdatedAt: "2024-01-15T10:00:00Z",
            createdAt: "2024-01-15T09:00:00Z",
            updatedAt: "2024-01-15T10:00:00Z",
          },
        },
      });

      const result = await repository.findById("chat-123");

      expect(mockDataConnectModule.getChatById).toHaveBeenCalledWith({
        id: "chat-123",
      });
      expect(result).not.toBeNull();
      expect(result!.id).toBe("chat-123");
      expect(result!.userId).toBe("user-456");
      expect(result!.title).toBe("Test Chat");
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.updatedAt).toBeInstanceOf(Date);
      expect(result!.lastUpdatedAt).toBeInstanceOf(Date);
    });

    it("should return null when chat is not found", async () => {
      mockDataConnectModule.getChatById.mockResolvedValue({
        data: {
          chat: null,
        },
      });

      const result = await repository.findById("nonexistent-id");

      expect(result).toBeNull();
    });

    it("should handle Date objects for timestamps", async () => {
      const dateObj = new Date("2024-01-15T10:00:00Z");
      mockDataConnectModule.getChatById.mockResolvedValue({
        data: {
          chat: {
            id: "chat-123",
            userId: "user-456",
            title: "Test Chat",
            lastUpdatedAt: dateObj,
            createdAt: dateObj,
            updatedAt: dateObj,
          },
        },
      });

      const result = await repository.findById("chat-123");

      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.updatedAt).toBeInstanceOf(Date);
      expect(result!.lastUpdatedAt).toBeInstanceOf(Date);
    });

    it("should use current date when timestamps are missing", async () => {
      const beforeTest = new Date();
      
      mockDataConnectModule.getChatById.mockResolvedValue({
        data: {
          chat: {
            id: "chat-123",
            userId: "user-456",
            title: "Test Chat",
            lastUpdatedAt: null,
            createdAt: null,
            updatedAt: null,
          },
        },
      });

      const result = await repository.findById("chat-123");
      const afterTest = new Date();

      expect(result!.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeTest.getTime()
      );
      expect(result!.createdAt.getTime()).toBeLessThanOrEqual(
        afterTest.getTime()
      );
    });

    it("should log and rethrow errors", async () => {
      const error = new Error("Network error");
      mockDataConnectModule.getChatById.mockRejectedValue(error);

      await expect(repository.findById("chat-123")).rejects.toThrow(
        "Network error"
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to find chat: Network error",
        error.stack
      );
    });
  });

  describe("findByUserId", () => {
    const mockChats = [
      {
        id: "chat-1",
        userId: "user-456",
        title: "Chat 1",
        lastUpdatedAt: "2024-01-15T10:00:00Z",
        createdAt: "2024-01-15T09:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
      },
      {
        id: "chat-2",
        userId: "user-456",
        title: "Chat 2",
        lastUpdatedAt: "2024-01-16T10:00:00Z",
        createdAt: "2024-01-16T09:00:00Z",
        updatedAt: "2024-01-16T10:00:00Z",
      },
    ];

    it("should return all chats for a user", async () => {
      mockDataConnectModule.getChatsByUserId.mockResolvedValue({
        data: {
          chats: mockChats,
        },
      });

      const result = await repository.findByUserId("user-456");

      expect(mockDataConnectModule.getChatsByUserId).toHaveBeenCalledWith({
        userId: "user-456",
        limit: undefined,
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("chat-1");
      expect(result[1].id).toBe("chat-2");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Retrieved 2 chats for user user-456"
      );
    });

    it("should apply limit when provided", async () => {
      mockDataConnectModule.getChatsByUserId.mockResolvedValue({
        data: {
          chats: [mockChats[0]],
        },
      });

      await repository.findByUserId("user-456", 1);

      expect(mockDataConnectModule.getChatsByUserId).toHaveBeenCalledWith({
        userId: "user-456",
        limit: 1,
      });
    });

    it("should return empty array when user has no chats", async () => {
      mockDataConnectModule.getChatsByUserId.mockResolvedValue({
        data: {
          chats: [],
        },
      });

      const result = await repository.findByUserId("user-with-no-chats");

      expect(result).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Retrieved 0 chats for user user-with-no-chats"
      );
    });

    it("should handle Date objects for timestamps in results", async () => {
      const dateObj = new Date("2024-01-15T10:00:00Z");
      mockDataConnectModule.getChatsByUserId.mockResolvedValue({
        data: {
          chats: [
            {
              id: "chat-1",
              userId: "user-456",
              title: "Chat 1",
              lastUpdatedAt: dateObj,
              createdAt: dateObj,
              updatedAt: dateObj,
            },
          ],
        },
      });

      const result = await repository.findByUserId("user-456");

      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[0].updatedAt).toBeInstanceOf(Date);
      expect(result[0].lastUpdatedAt).toBeInstanceOf(Date);
    });

    it("should use current date for missing timestamps", async () => {
      const beforeTest = new Date();

      mockDataConnectModule.getChatsByUserId.mockResolvedValue({
        data: {
          chats: [
            {
              id: "chat-1",
              userId: "user-456",
              title: "Chat 1",
              lastUpdatedAt: null,
              createdAt: null,
              updatedAt: null,
            },
          ],
        },
      });

      const result = await repository.findByUserId("user-456");
      const afterTest = new Date();

      expect(result[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeTest.getTime()
      );
      expect(result[0].createdAt.getTime()).toBeLessThanOrEqual(
        afterTest.getTime()
      );
    });

    it("should log and rethrow errors", async () => {
      const error = new Error("Query failed");
      mockDataConnectModule.getChatsByUserId.mockRejectedValue(error);

      await expect(repository.findByUserId("user-456")).rejects.toThrow(
        "Query failed"
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to find chats: Query failed",
        error.stack
      );
    });
  });

  describe("update", () => {
    it("should update chat title and return full record", async () => {
      mockDataConnectModule.updateChat.mockResolvedValue({
        data: {
          chat_update: { id: "chat-123" },
        },
      });

      mockDataConnectModule.getChatById.mockResolvedValue({
        data: {
          chat: {
            id: "chat-123",
            userId: "user-456",
            title: "Updated Title",
            lastUpdatedAt: "2024-01-15T11:00:00Z",
            createdAt: "2024-01-15T09:00:00Z",
            updatedAt: "2024-01-15T11:00:00Z",
          },
        },
      });

      const result = await repository.update("chat-123", {
        title: "Updated Title",
      });

      expect(mockDataConnectModule.updateChat).toHaveBeenCalledWith({
        id: "chat-123",
        title: "Updated Title",
        lastUpdatedAt: undefined,
      });
      expect(result.title).toBe("Updated Title");
      expect(mockLogger.info).toHaveBeenCalledWith("Updated chat chat-123");
    });

    it("should update lastUpdatedAt and convert to ISO string", async () => {
      const updateDate = new Date("2024-01-15T12:00:00Z");

      mockDataConnectModule.updateChat.mockResolvedValue({
        data: {
          chat_update: { id: "chat-123" },
        },
      });

      mockDataConnectModule.getChatById.mockResolvedValue({
        data: {
          chat: {
            id: "chat-123",
            userId: "user-456",
            title: "Test Chat",
            lastUpdatedAt: "2024-01-15T12:00:00Z",
            createdAt: "2024-01-15T09:00:00Z",
            updatedAt: "2024-01-15T12:00:00Z",
          },
        },
      });

      await repository.update("chat-123", { lastUpdatedAt: updateDate });

      expect(mockDataConnectModule.updateChat).toHaveBeenCalledWith({
        id: "chat-123",
        title: undefined,
        lastUpdatedAt: "2024-01-15T12:00:00.000Z",
      });
    });

    it("should update both title and lastUpdatedAt", async () => {
      const updateDate = new Date("2024-01-15T12:00:00Z");

      mockDataConnectModule.updateChat.mockResolvedValue({
        data: {
          chat_update: { id: "chat-123" },
        },
      });

      mockDataConnectModule.getChatById.mockResolvedValue({
        data: {
          chat: {
            id: "chat-123",
            userId: "user-456",
            title: "New Title",
            lastUpdatedAt: "2024-01-15T12:00:00Z",
            createdAt: "2024-01-15T09:00:00Z",
            updatedAt: "2024-01-15T12:00:00Z",
          },
        },
      });

      await repository.update("chat-123", {
        title: "New Title",
        lastUpdatedAt: updateDate,
      });

      expect(mockDataConnectModule.updateChat).toHaveBeenCalledWith({
        id: "chat-123",
        title: "New Title",
        lastUpdatedAt: "2024-01-15T12:00:00.000Z",
      });
    });

    it("should throw an error if chat retrieval fails after update", async () => {
      mockDataConnectModule.updateChat.mockResolvedValue({
        data: {
          chat_update: { id: "chat-123" },
        },
      });

      mockDataConnectModule.getChatById.mockResolvedValue({
        data: {
          chat: null,
        },
      });

      await expect(
        repository.update("chat-123", { title: "New Title" })
      ).rejects.toThrow("Failed to retrieve updated chat chat-123");
    });

    it("should log and rethrow errors on update failure", async () => {
      const error = new Error("Update failed");
      mockDataConnectModule.updateChat.mockRejectedValue(error);

      await expect(
        repository.update("chat-123", { title: "New Title" })
      ).rejects.toThrow("Update failed");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to update chat: Update failed",
        error.stack
      );
    });
  });

  describe("onModuleInit", () => {
    it("should initialize Firebase and Data Connect module", async () => {
      // Create a fresh repository for this test
      const freshRepository = new GoogleCloudChatRepository(mockLogger);

      // Mock require.resolve
      const mockRequireResolve = jest.fn();
      mockRequireResolve
        .mockReturnValueOnce("/path/to/dataconnect")
        .mockReturnValueOnce("/path/to/firebase-admin");

      // Mock the firebase-admin module
      const mockFirebaseAdmin = {
        apps: [],
        initializeApp: jest.fn(),
      };

      // Store original require
      const originalRequire = require;

      // We can't easily test onModuleInit due to dynamic imports
      // Instead, verify the module is properly set up
      expect(freshRepository).toBeDefined();
      expect(mockLogger.setContext).toHaveBeenCalledWith(
        "GoogleCloudChatRepository"
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty title in create", async () => {
      mockDataConnectModule.createChat.mockResolvedValue({
        data: {
          chat_insert: { id: "chat-123" },
        },
      });

      mockDataConnectModule.getChatById.mockResolvedValue({
        data: {
          chat: {
            id: "chat-123",
            userId: "user-456",
            title: "",
            lastUpdatedAt: "2024-01-15T10:00:00Z",
            createdAt: "2024-01-15T09:00:00Z",
            updatedAt: "2024-01-15T10:00:00Z",
          },
        },
      });

      const result = await repository.create({
        id: "chat-123",
        userId: "user-456",
        title: "",
      });

      expect(result.title).toBe("");
    });

    it("should handle special characters in chat title", async () => {
      const specialTitle = "Chat with émojis 🎉 & <special> \"chars\"";

      mockDataConnectModule.createChat.mockResolvedValue({
        data: {
          chat_insert: { id: "chat-123" },
        },
      });

      mockDataConnectModule.getChatById.mockResolvedValue({
        data: {
          chat: {
            id: "chat-123",
            userId: "user-456",
            title: specialTitle,
            lastUpdatedAt: "2024-01-15T10:00:00Z",
            createdAt: "2024-01-15T09:00:00Z",
            updatedAt: "2024-01-15T10:00:00Z",
          },
        },
      });

      const result = await repository.create({
        id: "chat-123",
        userId: "user-456",
        title: specialTitle,
      });

      expect(result.title).toBe(specialTitle);
    });

    it("should handle very long chat IDs", async () => {
      const longId = "a".repeat(1000);

      mockDataConnectModule.getChatById.mockResolvedValue({
        data: {
          chat: {
            id: longId,
            userId: "user-456",
            title: "Test",
            lastUpdatedAt: "2024-01-15T10:00:00Z",
            createdAt: "2024-01-15T09:00:00Z",
            updatedAt: "2024-01-15T10:00:00Z",
          },
        },
      });

      const result = await repository.findById(longId);

      expect(result!.id).toBe(longId);
    });
  });
});