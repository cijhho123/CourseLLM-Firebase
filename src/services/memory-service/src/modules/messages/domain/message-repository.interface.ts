import { MessageRecord, CreateMessageData } from "./message.types";

export interface IMessageRepository {
  create(data: CreateMessageData): Promise<MessageRecord>;
  findMessagesByChatId(chatId: string): Promise<MessageRecord[]>;
  getNextSequenceNumber(chatId: string): Promise<number>;
}
