export interface ChatRecord {
    id: string;
    userId: string;
    title: string | null;
    lastUpdatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface ChatWithMessages {
    id: string;
    userId: string;
    title: string | null;
    messages: Message[];
}

export interface Message {
    content: string;
    sender: string;
}

export interface CreateChatData {
    id: string;
    userId: string;
    title?: string;
}