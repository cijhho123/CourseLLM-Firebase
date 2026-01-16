import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { CustomLoggerService } from "../../../../common/logger/logger.service";
import { IChatService, IChatRepository } from "../../domain/chat-service.interface";
import { ChatWithMessages, ChatRecord, CreateChatData } from "../../domain/chat.types";
import { IMessageRepository } from "../../../messages/domain/message-repository.interface";

@Injectable()
export class ChatService implements IChatService {
    constructor(
        @Inject("IChatRepository")
        private readonly chatRepository: IChatRepository,
        @Inject("IMessageRepository")
        private readonly messageRepository: IMessageRepository,
        private readonly logger: CustomLoggerService
    ) {
        this.logger.setContext("ChatService");
    }

    async findChatWithMessages(chatId: string): Promise<ChatWithMessages | null> {
        try {
            const chat = await this.chatRepository.findById(chatId);
            if (!chat) {
                return null;
            }

            const messages = await this.messageRepository.findMessagesByChatId(chatId);
            
            return {
                id: chat.id,
                userId: chat.userId,
                title: chat.title,
                messages: messages.map((msg) => ({
                    content: msg.content,
                    sender: msg.sender,
                })),
            };
        } catch (error) {
            this.logger.error(`Failed to find chat with messages: ${error.message}`, error.stack);
            throw error;
        }
    }

    async findChatById(chatId: string): Promise<ChatRecord | null> {
        return this.chatRepository.findById(chatId);
    }

    async findChatsByUserId(userId: string, limit?: number): Promise<ChatRecord[]> {
        return this.chatRepository.findByUserId(userId, limit);
    }

    async createChat(data: CreateChatData): Promise<ChatRecord> {
        return this.chatRepository.create(data);
    }

    async updateChat(
        chatId: string,
        updates: { title?: string; lastUpdatedAt?: Date }
    ): Promise<ChatRecord> {
        return this.chatRepository.update(chatId, updates);
    }
}
