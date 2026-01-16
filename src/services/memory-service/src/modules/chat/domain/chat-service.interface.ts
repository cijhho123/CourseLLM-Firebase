import { ChatWithMessages, ChatRecord, CreateChatData } from "./chat.types";

export interface IChatRepository {
    create(data: CreateChatData): Promise<ChatRecord>;
    findById(chatId: string): Promise<ChatRecord | null>;
    findByUserId(userId: string, limit?: number): Promise<ChatRecord[]>;
    update(chatId: string, updates: { title?: string; lastUpdatedAt?: Date }): Promise<ChatRecord>;
}

export interface IChatService {
    findChatWithMessages(chatId: string): Promise<ChatWithMessages | null>;
    findChatById(chatId: string): Promise<ChatRecord | null>;
    findChatsByUserId(userId: string, limit?: number): Promise<ChatRecord[]>;
    createChat(data: CreateChatData): Promise<ChatRecord>;
    updateChat(chatId: string, updates: { title?: string; lastUpdatedAt?: Date }): Promise<ChatRecord>;
}
