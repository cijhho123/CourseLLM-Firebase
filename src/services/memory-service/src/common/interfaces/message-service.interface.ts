export interface SaveMessageRequest {
    chatID?: string;
    userID?: string;
    content: string;
    sender: string;
    metadata?: Record<string, any>;
}

export interface SaveMessageResponse {
    success: boolean;
    chatID: string;
    messageID: string;
    timestamp: string;
}

export interface IMessageService {
    saveMessage(request: SaveMessageRequest): Promise<SaveMessageResponse>;
}
