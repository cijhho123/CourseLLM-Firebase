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