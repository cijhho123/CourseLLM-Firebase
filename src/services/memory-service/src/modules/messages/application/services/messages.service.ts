import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { CustomLoggerService } from "../../../../common/logger/logger.service";
import { IMessageRepository } from "../../domain/message-repository.interface";
import { SaveMessageDto } from "../dto/save-message.dto";
import { IChatService } from "../../../chat/domain/chat-service.interface";

@Injectable()
export class MessagesService {
    constructor(
        @Inject("IMessageRepository")
        private readonly messageRepository: IMessageRepository,
        @Inject("IChatService")
        private readonly chatService: IChatService,
        private readonly logger: CustomLoggerService
    ) {
        this.logger.setContext("MessagesService");
    }

    /**
     * Save a message to a conversation
     */
    async saveMessage(chatId: string, dto: SaveMessageDto) {
        this.logger.info(`Saving message to chat ${chatId}`);

        try {
            // Verify chat exists
            const chat = await this.chatService.findChatById(chatId);
            if (!chat) {
                throw new NotFoundException(`Chat ${chatId} not found`);
            }

            // Get next sequence number
            const sequenceNumber = await this.messageRepository.getNextSequenceNumber(chatId);

            // Create message
            const message = await this.messageRepository.create({
                chatId,
                content: dto.content,
                sender: dto.sender,
                sequenceNumber,
            });

            this.logger.info(`Message saved successfully in chat ${chatId}`);

            return {
                success: true,
                message: "Message saved successfully",
                chatID: chatId,
                messageID: message.id,
            };
        } catch (error) {
            this.logger.error(`Failed to save message: ${error.message}`, error.stack);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new Error(`Failed to save message: ${error.message}`);
        }
    }
}
