import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from "@nestjs/swagger";
import { ChatService } from "./application/services/chat.service";
import { CreateChatDto } from "./application/dto/create-chat.dto";
import { GetUserChatsDto } from "./application/dto/get-user-chats.dto";
import * as uuid from "uuid";

@ApiTags("chats")
@Controller("api/v1/memory/conversations")
export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: "Create a new chat conversation",
    })
    @ApiResponse({
        status: 201,
        description: "Chat created successfully",
        schema: {
            example: {
                success: true,
                message: "Chat created successfully",
                chatID: "chat_xyz789",
            },
        },
    })
    async createChat(@Body() dto: CreateChatDto) {
        const chatId = `chat_${uuid.v4()}`;
        const chat = await this.chatService.createChat({
            id: chatId,
            userId: dto.userID,
            title: dto.title,
        });

        return {
            success: true,
            message: "Chat created successfully",
            chatID: chat.id,
        };
    }

    @Get(":chatID")
    @ApiOperation({
        summary: "Get a chat conversation with messages",
    })
    @ApiParam({
        name: "chatID",
        description: "Chat identifier",
        example: "chat_xyz789",
    })
    @ApiResponse({
        status: 200,
        description: "Chat retrieved successfully",
        schema: {
            example: {
                id: "chat_xyz789",
                userId: "user_abc123",
                title: "Calculus Study Session",
                messages: [
                    {
                        content: "Can you explain derivatives?",
                        sender: "user",
                    },
                ],
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: "Chat not found",
    })
    async getChat(@Param("chatID") chatID: string) {
        const chat = await this.chatService.findChatWithMessages(chatID);
        if (!chat) {
            throw new NotFoundException(`Chat ${chatID} not found`);
        }
        return chat;
    }

    @Get("users/:userID")
    @ApiOperation({
        summary: "Get all conversations for a user",
    })
    @ApiParam({
        name: "userID",
        description: "User identifier",
        example: "user_abc123",
    })
    @ApiQuery({
        name: "limit",
        required: false,
        type: Number,
        description: "Maximum number of conversations to return",
        example: 50,
    })
    @ApiResponse({
        status: 200,
        description: "Conversations retrieved successfully",
        schema: {
            example: {
                userID: "user_abc123",
                conversations: [
                    {
                        chatID: "chat_xyz789",
                        title: "Calculus Study Session",
                        lastUpdatedAt: "2025-11-20T10:30:00.000Z",
                        createdAt: "2025-11-20T10:00:00.000Z",
                    },
                ],
            },
        },
    })
    async getUserConversations(
        @Param("userID") userID: string,
        @Query() dto: GetUserChatsDto
    ) {
        const chats = await this.chatService.findChatsByUserId(userID, dto.limit);

        return {
            userID,
            conversations: chats.map((chat) => ({
                chatID: chat.id,
                title: chat.title,
                lastUpdatedAt: chat.lastUpdatedAt.toISOString(),
                createdAt: chat.createdAt.toISOString(),
            })),
        };
    }
}
