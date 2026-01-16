import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { MemoriesService } from "./memories.service";
import { Mem0Service } from "../../infrastructure/mem0.service";
import { CustomLoggerService } from "../../../../common/logger/logger.service";
import { IMemoryRepository } from "../../domain/memory-repository.interface";
import { IChatService } from "../../../chat/domain/chat-service.interface";
import { IUserService } from "../../../user/domain/user-service.interface";
import { SynthesizeMemoriesDto } from "../dto/synthesize-memories.dto";

describe("MemoriesService", () => {
    let service: MemoriesService;
    let chatService: jest.Mocked<IChatService>;
    let userService: jest.Mocked<IUserService>;
    let memoryRepository: jest.Mocked<IMemoryRepository>;
    let mem0Service: jest.Mocked<Mem0Service>;
    let logger: jest.Mocked<CustomLoggerService>;

    const mockUserId = "user_123";
    const mockChatId = "chat_abc123";

    beforeEach(async () => {
        // Create mock services
        const mockChatService = {
            findChatWithMessages: jest.fn(),
        };

        const mockUserService = {
            findUser: jest.fn(),
        };

        const mockMemoryRepository = {
            findByUserId: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };

        const mockMem0Service = {
            addMemories: jest.fn(),
            searchMemories: jest.fn(),
            getAllMemories: jest.fn(),
        };

        const mockLogger = {
            setContext: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MemoriesService,
                {
                    provide: "IChatService",
                    useValue: mockChatService,
                },
                {
                    provide: "IUserService",
                    useValue: mockUserService,
                },
                {
                    provide: "IMemoryRepository",
                    useValue: mockMemoryRepository,
                },
                {
                    provide: Mem0Service,
                    useValue: mockMem0Service,
                },
                {
                    provide: CustomLoggerService,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        service = module.get<MemoriesService>(MemoriesService);
        chatService = module.get("IChatService");
        userService = module.get("IUserService");
        memoryRepository = module.get("IMemoryRepository");
        mem0Service = module.get(Mem0Service);
        logger = module.get(CustomLoggerService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("initialization", () => {
        it("should be defined", () => {
            expect(service).toBeDefined();
        });

        it("should set logger context to MemoriesService", () => {
            expect(logger.setContext).toHaveBeenCalledWith("MemoriesService");
        });
    });

    describe("synthesizeMemories", () => {
        const mockDto: SynthesizeMemoriesDto = {
            chatID: mockChatId,
            query: "test query",
        };

        const mockChat = {
            id: mockChatId,
            userId: mockUserId,
            title: "Test Chat",
            messages: [
                { sender: "user", content: "Hello!" },
                { sender: "assistant", content: "Hi there!" },
                { sender: "user", content: "How are you?" },
            ],
        };

        it("should successfully synthesize memories for a valid chat", async () => {
            const mockMem0Response = [
                {
                    id: "event_123",
                    memory: "User greeted assistant",
                    user_id: mockUserId,
                    metadata: {
                        status: "queued",
                        chat_id: mockChatId,
                        query: "test query",
                    },
                },
            ];

            chatService.findChatWithMessages.mockResolvedValue(mockChat as any);
            mem0Service.addMemories.mockResolvedValue(mockMem0Response as any);

            const result = await service.synthesizeMemories(mockDto);

            expect(chatService.findChatWithMessages).toHaveBeenCalledWith(mockChatId);
            expect(mem0Service.addMemories).toHaveBeenCalledWith(
                expect.arrayContaining([
                    { role: "user", content: "Hello!" },
                    { role: "assistant", content: "Hi there!" },
                    { role: "user", content: "How are you?" },
                ]),
                mockUserId,
                expect.objectContaining({
                    chat_id: mockChatId,
                    query: "test query",
                })
            );

            expect(result).toEqual({
                success: true,
                message: "Memory synthesis queued",
                event_id: "event_123",
                status: "queued",
            });
        });

        it("should synthesize memories without query parameter", async () => {
            const dtoWithoutQuery: SynthesizeMemoriesDto = {
                chatID: mockChatId,
            };

            const mockMem0Response = [
                {
                    id: "event_456",
                    memory: "Memory",
                    user_id: mockUserId,
                    metadata: { status: "queued" },
                },
            ];

            chatService.findChatWithMessages.mockResolvedValue(mockChat as any);
            mem0Service.addMemories.mockResolvedValue(mockMem0Response as any);

            const result = await service.synthesizeMemories(dtoWithoutQuery);

            expect(mem0Service.addMemories).toHaveBeenCalledWith(
                expect.any(Array),
                mockUserId,
                expect.objectContaining({
                    chat_id: mockChatId,
                    query: undefined,
                })
            );

            expect(result.success).toBe(true);
            expect(result.event_id).toBe("event_456");
        });

        it("should throw NotFoundException when chat does not exist", async () => {
            chatService.findChatWithMessages.mockResolvedValue(null);

            await expect(service.synthesizeMemories(mockDto)).resolves.toEqual({
                success: false,
                message: "Failed to queue memory synthesis",
                error: `Chat ${mockChatId} not found`,
                event_id: null,
            });

            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`Chat ${mockChatId} not found`)
            );
        });

        it("should handle chat with no messages", async () => {
            const emptyChat = {
                ...mockChat,
                messages: [],
            };

            chatService.findChatWithMessages.mockResolvedValue(emptyChat as any);

            const result = await service.synthesizeMemories(mockDto);

            expect(result).toEqual({
                success: true,
                message: "No messages to synthesize",
                memoriesCreated: 0,
                event_id: null,
            });

            expect(mem0Service.addMemories).not.toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("has no messages, skipping synthesis")
            );
        });

        it("should convert messages to mem0 format correctly", async () => {
            const mockMem0Response = [
                {
                    id: "event_789",
                    memory: "Memory",
                    user_id: mockUserId,
                    metadata: { status: "queued" },
                },
            ];

            chatService.findChatWithMessages.mockResolvedValue(mockChat as any);
            mem0Service.addMemories.mockResolvedValue(mockMem0Response as any);

            await service.synthesizeMemories(mockDto);

            const calledMessages = mem0Service.addMemories.mock.calls[0][0];

            expect(calledMessages).toHaveLength(3);
            expect(calledMessages[0]).toEqual({
                role: "user",
                content: "Hello!",
            });
            expect(calledMessages[1]).toEqual({
                role: "assistant",
                content: "Hi there!",
            });
            expect(calledMessages[2]).toEqual({
                role: "user",
                content: "How are you?",
            });
        });

        it("should include metadata with timestamp", async () => {
            const mockMem0Response = [
                {
                    id: "event_101",
                    memory: "Memory",
                    user_id: mockUserId,
                    metadata: { status: "queued" },
                },
            ];

            chatService.findChatWithMessages.mockResolvedValue(mockChat as any);
            mem0Service.addMemories.mockResolvedValue(mockMem0Response as any);

            const beforeTime = new Date().toISOString();
            await service.synthesizeMemories(mockDto);
            const afterTime = new Date().toISOString();

            const calledMetadata = mem0Service.addMemories.mock.calls[0][2];

            expect(calledMetadata).toHaveProperty("chat_id", mockChatId);
            expect(calledMetadata).toHaveProperty("query", "test query");
            expect(calledMetadata).toHaveProperty("timestamp");
            expect(calledMetadata.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
        });

        it("should log info messages during execution", async () => {
            const mockMem0Response = [
                {
                    id: "event_202",
                    memory: "Memory",
                    user_id: mockUserId,
                    metadata: { status: "queued" },
                },
            ];

            chatService.findChatWithMessages.mockResolvedValue(mockChat as any);
            mem0Service.addMemories.mockResolvedValue(mockMem0Response as any);

            await service.synthesizeMemories(mockDto);

            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("Queueing memory synthesis for chat")
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("Fetching chat")
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("Calling mem0 service")
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("Memory synthesis queued")
            );
        });

        it("should return error object when mem0Service.addMemories fails", async () => {
            const errorMessage = "Mem0 API error";
            chatService.findChatWithMessages.mockResolvedValue(mockChat as any);
            mem0Service.addMemories.mockRejectedValue(new Error(errorMessage));

            const result = await service.synthesizeMemories(mockDto);

            expect(result).toEqual({
                success: false,
                message: "Failed to queue memory synthesis",
                error: errorMessage,
                event_id: null,
            });

            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to queue memory synthesis"),
                expect.any(String)
            );
        });

        it("should handle chat service errors gracefully", async () => {
            const errorMessage = "Database connection error";
            chatService.findChatWithMessages.mockRejectedValue(
                new Error(errorMessage)
            );

            const result = await service.synthesizeMemories(mockDto);

            expect(result).toEqual({
                success: false,
                message: "Failed to queue memory synthesis",
                error: errorMessage,
                event_id: null,
            });
        });

        it("should handle system role messages", async () => {
            const chatWithSystem = {
                ...mockChat,
                messages: [
                    { sender: "system", content: "System message" },
                    { sender: "user", content: "User message" },
                    { sender: "assistant", content: "Assistant message" },
                ],
            };

            const mockMem0Response = [
                {
                    id: "event_303",
                    memory: "Memory",
                    user_id: mockUserId,
                    metadata: { status: "queued" },
                },
            ];

            chatService.findChatWithMessages.mockResolvedValue(chatWithSystem as any);
            mem0Service.addMemories.mockResolvedValue(mockMem0Response as any);

            await service.synthesizeMemories(mockDto);

            const calledMessages = mem0Service.addMemories.mock.calls[0][0];

            expect(calledMessages).toHaveLength(3);
            expect(calledMessages[0].role).toBe("system");
        });
    });

    describe("getUserMemories", () => {
        const mockUser = {
            id: mockUserId,
            email: "test@example.com",
        };

        const mockLocalMemories = [
            {
                id: "mem_local_1",
                userId: mockUserId,
                content: "User likes Python programming",
                mem0MemoryId: "mem0_1",
                sourceChatIds: ["chat_1", "chat_2"],
                createdAt: new Date("2024-01-01"),
            },
            {
                id: "mem_local_2",
                userId: mockUserId,
                content: "User is learning calculus",
                mem0MemoryId: "mem0_2",
                sourceChatIds: ["chat_3"],
                createdAt: new Date("2024-01-02"),
            },
        ];

        it("should retrieve memories from local database when available", async () => {
            userService.findUser.mockResolvedValue(mockUser as any);
            memoryRepository.findByUserId.mockResolvedValue(mockLocalMemories as any);

            const result = await service.getUserMemories(mockUserId);

            expect(userService.findUser).toHaveBeenCalledWith(mockUserId);
            expect(memoryRepository.findByUserId).toHaveBeenCalledWith(mockUserId);
            expect(mem0Service.getAllMemories).not.toHaveBeenCalled();

            expect(result.memories).toHaveLength(2);
            expect(result.memories[0]).toEqual({
                memoryID: "mem_local_1",
                content: "User likes Python programming",
                createdAt: "2024-01-01T00:00:00.000Z",
                relatedChats: ["chat_1", "chat_2"],
            });
            expect(result.memories[1]).toEqual({
                memoryID: "mem_local_2",
                content: "User is learning calculus",
                createdAt: "2024-01-02T00:00:00.000Z",
                relatedChats: ["chat_3"],
            });
        });

        it("should throw NotFoundException when user does not exist", async () => {
            userService.findUser.mockResolvedValue(null);

            await expect(service.getUserMemories(mockUserId)).rejects.toThrow(
                `Failed to retrieve memories: User ${mockUserId} not found`
            );

            expect(memoryRepository.findByUserId).not.toHaveBeenCalled();
        });

        it("should fallback to mem0.ai when no local memories exist", async () => {
            const mockMem0Memories = [
                {
                    id: "mem0_remote_1",
                    memory: "User prefers visual explanations",
                    user_id: mockUserId,
                },
                {
                    id: "mem0_remote_2",
                    memory: "User is interested in AI",
                    user_id: mockUserId,
                },
            ];

            const savedMemory1 = {
                id: "mem_saved_1",
                userId: mockUserId,
                content: "User prefers visual explanations",
                mem0MemoryId: "mem0_remote_1",
                sourceChatIds: [],
                createdAt: new Date("2024-01-03"),
            };

            const savedMemory2 = {
                id: "mem_saved_2",
                userId: mockUserId,
                content: "User is interested in AI",
                mem0MemoryId: "mem0_remote_2",
                sourceChatIds: [],
                createdAt: new Date("2024-01-03"),
            };

            userService.findUser.mockResolvedValue(mockUser as any);
            memoryRepository.findByUserId.mockResolvedValue([]);
            mem0Service.getAllMemories.mockResolvedValue(mockMem0Memories as any);
            memoryRepository.create
                .mockResolvedValueOnce(savedMemory1 as any)
                .mockResolvedValueOnce(savedMemory2 as any);

            const result = await service.getUserMemories(mockUserId);

            expect(mem0Service.getAllMemories).toHaveBeenCalledWith(mockUserId);
            expect(memoryRepository.create).toHaveBeenCalledTimes(2);
            expect(memoryRepository.create).toHaveBeenCalledWith({
                userId: mockUserId,
                content: "User prefers visual explanations",
                mem0MemoryId: "mem0_remote_1",
                sourceChatIds: [],
            });

            expect(result.memories).toHaveLength(2);
            expect(result.memories[0].content).toBe("User prefers visual explanations");
            expect(result.memories[1].content).toBe("User is interested in AI");
        });

        it("should log sync operation when fetching from mem0.ai", async () => {
            const mockMem0Memories = [
                {
                    id: "mem0_1",
                    memory: "Test memory",
                    user_id: mockUserId,
                },
            ];

            const savedMemory = {
                id: "mem_1",
                userId: mockUserId,
                content: "Test memory",
                mem0MemoryId: "mem0_1",
                sourceChatIds: [],
                createdAt: new Date(),
            };

            userService.findUser.mockResolvedValue(mockUser as any);
            memoryRepository.findByUserId.mockResolvedValue([]);
            mem0Service.getAllMemories.mockResolvedValue(mockMem0Memories as any);
            memoryRepository.create.mockResolvedValue(savedMemory as any);

            await service.getUserMemories(mockUserId);

            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("No local memories for user")
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("Synced 1 memories from mem0.ai")
            );
        });

        it("should return empty array when no memories exist locally or remotely", async () => {
            userService.findUser.mockResolvedValue(mockUser as any);
            memoryRepository.findByUserId.mockResolvedValue([]);
            mem0Service.getAllMemories.mockResolvedValue([]);

            const result = await service.getUserMemories(mockUserId);

            expect(result.memories).toEqual([]);
            expect(memoryRepository.create).not.toHaveBeenCalled();
        });

        it("should handle errors when fetching from mem0.ai", async () => {
            const errorMessage = "Mem0 service unavailable";

            userService.findUser.mockResolvedValue(mockUser as any);
            memoryRepository.findByUserId.mockResolvedValue([]);
            mem0Service.getAllMemories.mockRejectedValue(new Error(errorMessage));

            await expect(service.getUserMemories(mockUserId)).rejects.toThrow(
                `Failed to retrieve memories: ${errorMessage}`
            );

            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to retrieve memories"),
                expect.any(String)
            );
        });

        it("should handle errors when creating local memories from mem0", async () => {
            const mockMem0Memories = [
                {
                    id: "mem0_1",
                    memory: "Test memory",
                    user_id: mockUserId,
                },
            ];

            const errorMessage = "Database write error";

            userService.findUser.mockResolvedValue(mockUser as any);
            memoryRepository.findByUserId.mockResolvedValue([]);
            mem0Service.getAllMemories.mockResolvedValue(mockMem0Memories as any);
            memoryRepository.create.mockRejectedValue(new Error(errorMessage));

            await expect(service.getUserMemories(mockUserId)).rejects.toThrow(
                `Failed to retrieve memories: ${errorMessage}`
            );
        });

        it("should log info message when retrieving memories", async () => {
            userService.findUser.mockResolvedValue(mockUser as any);
            memoryRepository.findByUserId.mockResolvedValue(mockLocalMemories as any);

            await service.getUserMemories(mockUserId);

            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Retrieving memories for user ${mockUserId}`)
            );
        });

        it("should handle memories with empty sourceChatIds", async () => {
            const memoryWithEmptyChats = [
                {
                    id: "mem_1",
                    userId: mockUserId,
                    content: "Test memory",
                    mem0MemoryId: "mem0_1",
                    sourceChatIds: [],
                    createdAt: new Date("2024-01-01"),
                },
            ];

            userService.findUser.mockResolvedValue(mockUser as any);
            memoryRepository.findByUserId.mockResolvedValue(memoryWithEmptyChats as any);

            const result = await service.getUserMemories(mockUserId);

            expect(result.memories[0].relatedChats).toEqual([]);
        });
    });

    describe("edge cases", () => {
        it("should handle concurrent synthesizeMemories calls", async () => {
            const mockChat = {
                id: mockChatId,
                userId: mockUserId,
                title: "Test Chat",
                messages: [{ sender: "user", content: "Hello" }],
            };

            const mockMem0Response = [
                {
                    id: "event_concurrent",
                    memory: "Memory",
                    user_id: mockUserId,
                    metadata: { status: "queued" },
                },
            ];

            chatService.findChatWithMessages.mockResolvedValue(mockChat as any);
            mem0Service.addMemories.mockResolvedValue(mockMem0Response as any);

            const dto1: SynthesizeMemoriesDto = { chatID: "chat_1" };
            const dto2: SynthesizeMemoriesDto = { chatID: "chat_2" };

            const promises = [
                service.synthesizeMemories(dto1),
                service.synthesizeMemories(dto2),
            ];

            const results = await Promise.all(promises);

            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(true);
        });

        it("should handle very long chat with many messages", async () => {
            const longMessages = Array.from({ length: 100 }, (_, i) => ({
                sender: i % 2 === 0 ? "user" : "assistant",
                content: `Message ${i}`,
            }));

            const longChat = {
                id: mockChatId,
                userId: mockUserId,
                title: "Long Chat",
                messages: longMessages,
            };

            const mockMem0Response = [
                {
                    id: "event_long",
                    memory: "Memory",
                    user_id: mockUserId,
                    metadata: { status: "queued" },
                },
            ];

            chatService.findChatWithMessages.mockResolvedValue(longChat as any);
            mem0Service.addMemories.mockResolvedValue(mockMem0Response as any);

            const result = await service.synthesizeMemories({ chatID: mockChatId });

            expect(result.success).toBe(true);
            expect(mem0Service.addMemories).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ content: "Message 0" }),
                ]),
                expect.any(String),
                expect.any(Object)
            );
        });

        it("should handle special characters in chat content", async () => {
            const chatWithSpecialChars = {
                id: mockChatId,
                userId: mockUserId,
                title: "Test Chat",
                messages: [
                    {
                        sender: "user",
                        content: "Hello! @#$%^&*() Test 你好 🎉",
                    },
                ],
            };

            const mockMem0Response = [
                {
                    id: "event_special",
                    memory: "Memory",
                    user_id: mockUserId,
                    metadata: { status: "queued" },
                },
            ];

            chatService.findChatWithMessages.mockResolvedValue(
                chatWithSpecialChars as any
            );
            mem0Service.addMemories.mockResolvedValue(mockMem0Response as any);

            const result = await service.synthesizeMemories({ chatID: mockChatId });

            expect(result.success).toBe(true);
        });
    });
});