import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { Mem0Service } from "./mem0.service";
import { CustomLoggerService } from "../../../common/logger/logger.service";
import { MemoryClient } from "mem0ai";

// Mock the mem0ai module
jest.mock("mem0ai", () => {
    return {
        MemoryClient: jest.fn().mockImplementation(() => ({
            add: jest.fn(),
            search: jest.fn(),
            getAll: jest.fn(),
        })),
    };
});

describe("Mem0Service", () => {
    let service: Mem0Service;
    let configService: ConfigService;
    let logger: CustomLoggerService;
    let mockMemoryClient: jest.Mocked<MemoryClient>;

    const mockApiKey = "test-api-key-12345";
    const mockUserId = "user_123";

    beforeEach(async () => {
        // Create mock logger
        const mockLogger = {
            setContext: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        // Create mock config service
        const mockConfig = {
            get: jest.fn((key: string) => {
                if (key === "MEM0_API_KEY") return mockApiKey;
                return undefined;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                Mem0Service,
                {
                    provide: ConfigService,
                    useValue: mockConfig,
                },
                {
                    provide: CustomLoggerService,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        service = module.get<Mem0Service>(Mem0Service);
        configService = module.get<ConfigService>(ConfigService);
        logger = module.get<CustomLoggerService>(CustomLoggerService);

        // Get the mocked MemoryClient instance
        mockMemoryClient = (service as any).client as jest.Mocked<MemoryClient>;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("initialization", () => {
        it("should be defined", () => {
            expect(service).toBeDefined();
        });

        it("should set logger context to Mem0Service", () => {
            expect(logger.setContext).toHaveBeenCalledWith("Mem0Service");
        });

        it("should retrieve API key from config service", () => {
            expect(configService.get).toHaveBeenCalledWith("MEM0_API_KEY");
        });

        it("should initialize MemoryClient with API key", () => {
            expect(MemoryClient).toHaveBeenCalledWith({ apiKey: mockApiKey });
        });

        it("should log successful initialization", () => {
            expect(logger.info).toHaveBeenCalledWith(
                "Mem0Service initialized with mem0.ai client"
            );
        });

        it("should warn when API key is not configured", async () => {
            // Create a new module with missing API key
            const mockConfigNoKey = {
                get: jest.fn(() => undefined),
            };

            const mockLoggerNoKey = {
                setContext: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            };

            const moduleNoKey: TestingModule = await Test.createTestingModule({
                providers: [
                    Mem0Service,
                    {
                        provide: ConfigService,
                        useValue: mockConfigNoKey,
                    },
                    {
                        provide: CustomLoggerService,
                        useValue: mockLoggerNoKey,
                    },
                ],
            }).compile();

            expect(mockLoggerNoKey.warn).toHaveBeenCalledWith(
                "MEM0_API_KEY not configured, service will not function properly"
            );
        });
    });

    describe("addMemories", () => {
        const mockMessages = [
            { role: "user" as const, content: "Hello, how are you?" },
            { role: "assistant" as const, content: "I'm doing well, thank you!" },
            { role: "user" as const, content: "Can you help me with something?" },
        ];

        const mockMetadata = { sessionId: "session_123", topic: "greeting" };

        it("should add memories successfully", async () => {
            const mockResponse = [
                {
                    id: "mem_1",
                    memory: "User greeted assistant",
                    metadata: mockMetadata,
                },
                {
                    id: "mem_2",
                    memory: "User requested help",
                    metadata: mockMetadata,
                },
            ];

            mockMemoryClient.add.mockResolvedValue(mockResponse);

            const result = await service.addMemories(
                mockMessages,
                mockUserId,
                mockMetadata
            );

            expect(mockMemoryClient.add).toHaveBeenCalledWith(
                mockMessages,
                { user_id: mockUserId, metadata: mockMetadata }
            );

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                id: "mem_1",
                memory: "User greeted assistant",
                user_id: mockUserId,
                metadata: mockMetadata,
            });
        });

        it("should filter out system messages", async () => {
            const messagesWithSystem = [
                { role: "system" as const, content: "You are a helpful assistant" },
                { role: "user" as const, content: "Hello" },
                { role: "assistant" as const, content: "Hi there!" },
            ];

            mockMemoryClient.add.mockResolvedValue([]);

            await service.addMemories(messagesWithSystem, mockUserId);

            const calledMessages = mockMemoryClient.add.mock.calls[0][0];
            expect(calledMessages).toHaveLength(2);
            expect(calledMessages.every((msg: any) => msg.role !== "system")).toBe(true);
        });

        it("should return empty array when all messages are system messages", async () => {
            const systemMessages = [
                { role: "system" as const, content: "System message 1" },
                { role: "system" as const, content: "System message 2" },
            ];

            const result = await service.addMemories(systemMessages, mockUserId);

            expect(result).toEqual([]);
            expect(mockMemoryClient.add).not.toHaveBeenCalled();
        });

        it("should return empty array when messages array is empty", async () => {
            const result = await service.addMemories([], mockUserId);

            expect(result).toEqual([]);
            expect(mockMemoryClient.add).not.toHaveBeenCalled();
        });

        it("should handle response with different property names", async () => {
            const mockResponse = [
                {
                    id: "mem_1",
                    memory: "Memory text",
                    memory_id: "mem_1",
                    text: "Memory text",
                },
                {
                    id: "mem_2",
                    memory: "Memory content",
                    content: "Memory content",
                },
            ] as any;

            mockMemoryClient.add.mockResolvedValue(mockResponse);

            const result = await service.addMemories(mockMessages, mockUserId);

            expect(result[0].id).toBe("mem_1");
            expect(result[0].memory).toBe("Memory text");
            expect(result[1].id).toBe("mem_2");
            expect(result[1].memory).toBe("Memory content");
        });

        it("should include metadata in the request", async () => {
            mockMemoryClient.add.mockResolvedValue([]);

            await service.addMemories(mockMessages, mockUserId, mockMetadata);

            expect(mockMemoryClient.add).toHaveBeenCalledWith(
                expect.any(Array),
                { user_id: mockUserId, metadata: mockMetadata }
            );
        });

        it("should work without metadata", async () => {
            mockMemoryClient.add.mockResolvedValue([]);

            await service.addMemories(mockMessages, mockUserId);

            expect(mockMemoryClient.add).toHaveBeenCalledWith(
                expect.any(Array),
                { user_id: mockUserId, metadata: undefined }
            );
        });

        it("should log info messages during execution", async () => {
            mockMemoryClient.add.mockResolvedValue([]);

            await service.addMemories(mockMessages, mockUserId, mockMetadata);

            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Adding memories for user ${mockUserId}`)
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Metadata: ${JSON.stringify(mockMetadata)}`)
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Memory job queued for user ${mockUserId}`)
            );
        });

        it("should throw error when client.add fails", async () => {
            const errorMessage = "API connection failed";
            mockMemoryClient.add.mockRejectedValue(new Error(errorMessage));

            await expect(
                service.addMemories(mockMessages, mockUserId)
            ).rejects.toThrow(`Failed to add memories: ${errorMessage}`);

            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Failed to add memories for user ${mockUserId}`),
                expect.any(String)
            );
        });

        it("should handle non-array response from client", async () => {
            mockMemoryClient.add.mockResolvedValue({} as any);

            const result = await service.addMemories(mockMessages, mockUserId);

            expect(result).toEqual([]);
        });
    });

    describe("searchMemories", () => {
        const mockQuery = "python programming";
        const mockLimit = 10;

        it("should search memories successfully", async () => {
            const mockResponse = [
                {
                    id: "mem_1",
                    memory: "User asked about Python list comprehensions",
                    metadata: { topic: "python" },
                },
                {
                    id: "mem_2",
                    memory: "User learned about Python functions",
                    metadata: { topic: "python" },
                },
            ];

            mockMemoryClient.search.mockResolvedValue(mockResponse);

            const result = await service.searchMemories(
                mockQuery,
                mockUserId,
                mockLimit
            );

            expect(mockMemoryClient.search).toHaveBeenCalledWith(mockQuery, {
                user_id: mockUserId,
                limit: mockLimit,
            });

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                id: "mem_1",
                memory: "User asked about Python list comprehensions",
                user_id: mockUserId,
                metadata: { topic: "python" },
            });
        });

        it("should use default limit of 10 when not provided", async () => {
            mockMemoryClient.search.mockResolvedValue([]);

            await service.searchMemories(mockQuery, mockUserId);

            expect(mockMemoryClient.search).toHaveBeenCalledWith(mockQuery, {
                user_id: mockUserId,
                limit: 10,
            });
        });

        it("should handle custom limit values", async () => {
            const customLimit = 5;
            mockMemoryClient.search.mockResolvedValue([]);

            await service.searchMemories(mockQuery, mockUserId, customLimit);

            expect(mockMemoryClient.search).toHaveBeenCalledWith(mockQuery, {
                user_id: mockUserId,
                limit: customLimit,
            });
        });

        it("should handle response with alternative property names", async () => {
            const mockResponse = [
                {
                    id: "mem_1",
                    memory: "Memory from text field",
                    memory_id: "mem_1",
                    text: "Memory from text field",
                },
                {
                    id: "mem_2",
                    memory: "Memory from content field",
                    content: "Memory from content field",
                },
            ] as any;

            mockMemoryClient.search.mockResolvedValue(mockResponse);

            const result = await service.searchMemories(mockQuery, mockUserId);

            expect(result[0].id).toBe("mem_1");
            expect(result[0].memory).toBe("Memory from text field");
            expect(result[1].id).toBe("mem_2");
            expect(result[1].memory).toBe("Memory from content field");
        });

        it("should return empty array when no results found", async () => {
            mockMemoryClient.search.mockResolvedValue([]);

            const result = await service.searchMemories(mockQuery, mockUserId);

            expect(result).toEqual([]);
        });

        it("should handle non-array response", async () => {
            mockMemoryClient.search.mockResolvedValue({} as any);

            const result = await service.searchMemories(mockQuery, mockUserId);

            expect(result).toEqual([]);
        });

        it("should log search activity", async () => {
            mockMemoryClient.search.mockResolvedValue([]);

            await service.searchMemories(mockQuery, mockUserId, mockLimit);

            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Searching memories for user ${mockUserId} with query: "${mockQuery}"`
                )
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("Raw search response:")
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Search returned 0 results for user ${mockUserId}`)
            );
        });

        it("should throw error when search fails", async () => {
            const errorMessage = "Search service unavailable";
            mockMemoryClient.search.mockRejectedValue(new Error(errorMessage));

            await expect(
                service.searchMemories(mockQuery, mockUserId)
            ).rejects.toThrow(`Failed to search memories: ${errorMessage}`);

            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Failed to search memories for user ${mockUserId}`),
                expect.any(String)
            );
        });
    });

    describe("getAllMemories", () => {
        it("should retrieve all memories successfully", async () => {
            const mockResponse = [
                {
                    id: "mem_1",
                    memory: "First memory",
                    metadata: { date: "2024-01-01" },
                },
                {
                    id: "mem_2",
                    memory: "Second memory",
                    metadata: { date: "2024-01-02" },
                },
                {
                    id: "mem_3",
                    memory: "Third memory",
                    metadata: { date: "2024-01-03" },
                },
            ];

            mockMemoryClient.getAll.mockResolvedValue(mockResponse);

            const result = await service.getAllMemories(mockUserId);

            expect(mockMemoryClient.getAll).toHaveBeenCalledWith({
                user_id: mockUserId,
            });

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({
                id: "mem_1",
                memory: "First memory",
                user_id: mockUserId,
                metadata: { date: "2024-01-01" },
            });
        });

        it("should handle empty results", async () => {
            mockMemoryClient.getAll.mockResolvedValue([]);

            const result = await service.getAllMemories(mockUserId);

            expect(result).toEqual([]);
        });

        it("should handle response with alternative property names", async () => {
            const mockResponse = [
                {
                    id: "mem_1",
                    memory: "Memory text",
                    memory_id: "mem_1",
                    text: "Memory text",
                },
                {
                    id: "mem_2",
                    memory: "Memory content",
                    content: "Memory content",
                },
            ] as any;

            mockMemoryClient.getAll.mockResolvedValue(mockResponse);

            const result = await service.getAllMemories(mockUserId);

            expect(result[0].id).toBe("mem_1");
            expect(result[0].memory).toBe("Memory text");
            expect(result[1].id).toBe("mem_2");
            expect(result[1].memory).toBe("Memory content");
        });

        it("should handle non-array response", async () => {
            mockMemoryClient.getAll.mockResolvedValue({} as any);

            const result = await service.getAllMemories(mockUserId);

            expect(result).toEqual([]);
        });

        it("should log retrieval activity", async () => {
            mockMemoryClient.getAll.mockResolvedValue([]);

            await service.getAllMemories(mockUserId);

            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Retrieving all memories for user ${mockUserId}`)
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("Raw getAll response:")
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Retrieved 0 memories for user ${mockUserId}`)
            );
        });

        it("should throw error when getAll fails", async () => {
            const errorMessage = "Database connection error";
            mockMemoryClient.getAll.mockRejectedValue(new Error(errorMessage));

            await expect(
                service.getAllMemories(mockUserId)
            ).rejects.toThrow(`Failed to get memories: ${errorMessage}`);

            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Failed to get all memories for user ${mockUserId}`),
                expect.any(String)
            );
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle undefined metadata gracefully in addMemories", async () => {
            mockMemoryClient.add.mockResolvedValue([
                { id: "mem_1", memory: "test" },
            ]);

            const messages = [{ role: "user" as const, content: "test" }];
            const result = await service.addMemories(messages, mockUserId, undefined);

            expect(result[0].metadata).toBeUndefined();
        });

        it("should handle memories with missing metadata", async () => {
            const mockResponse = [
                {
                    id: "mem_1",
                    memory: "Memory without metadata",
                },
            ] as any;

            mockMemoryClient.search.mockResolvedValue(mockResponse);

            const result = await service.searchMemories("query", mockUserId);

            expect(result[0].metadata).toBeUndefined();
        });

        it("should handle very long message content", async () => {
            const longContent = "a".repeat(10000);
            const messages = [{ role: "user" as const, content: longContent }];

            mockMemoryClient.add.mockResolvedValue([]);

            await expect(
                service.addMemories(messages, mockUserId)
            ).resolves.not.toThrow();
        });

        it("should handle special characters in search query", async () => {
            const specialQuery = "test@#$%^&*()query";
            mockMemoryClient.search.mockResolvedValue([]);

            await expect(
                service.searchMemories(specialQuery, mockUserId)
            ).resolves.not.toThrow();
        });

        it("should handle concurrent requests", async () => {
            mockMemoryClient.search.mockResolvedValue([]);
            mockMemoryClient.getAll.mockResolvedValue([]);

            const promises = [
                service.searchMemories("query1", mockUserId),
                service.searchMemories("query2", mockUserId),
                service.getAllMemories(mockUserId),
            ];

            await expect(Promise.all(promises)).resolves.not.toThrow();
        });
    });
});