export interface ChatWithMessages {
    id: string;
    userId: string;
    title: string | null;
    messages: {
        content: string;
        sender: string;
    }[];
}

export interface IChatService {
    findChatWithMessages(chatId: string): Promise<ChatWithMessages | null>;
}
