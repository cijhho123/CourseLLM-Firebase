import { ChatWithMessages } from "./chat.types";


export interface IChatService {
    findChatWithMessages(chatId: string): Promise<ChatWithMessages | null>;
}
