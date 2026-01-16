import {
    Controller,
    Post,
    Body,
    Param,
    HttpCode,
    HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { MessagesService } from "./application/services/messages.service";
import { SaveMessageDto } from "./application/dto/save-message.dto";

@ApiTags("messages")
@Controller("api/v1/memory/messages")
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) {}

    @Post(":chatID")
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: "Save a message to a conversation",
    })
    @ApiParam({
        name: "chatID",
        description: "Chat identifier",
        example: "chat_xyz789",
    })
    @ApiResponse({
        status: 201,
        description: "Message saved successfully",
        schema: {
            example: {
                success: true,
                message: "Message saved successfully",
                chatID: "chat_xyz789",
                messageID: "msg_abc123",
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: "Chat not found",
    })
    async saveMessage(@Param("chatID") chatID: string, @Body() dto: SaveMessageDto) {
        return this.messagesService.saveMessage(chatID, dto);
    }
}
