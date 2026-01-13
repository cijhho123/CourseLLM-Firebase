import { Injectable } from "@nestjs/common";
import {
    IMessageService,
    SaveMessageRequest,
    SaveMessageResponse,
} from "../interfaces";

@Injectable()
export class MockMessageService implements IMessageService {
    private messages: Array<
        SaveMessageRequest & { id: string; chatID: string; timestamp: Date }
    > = [];
    private messageIdCounter = 1;
    private chatIdCounter = 1;

    async saveMessage(
        request: SaveMessageRequest
    ): Promise<SaveMessageResponse> {
        const chatID = request.chatID || `mock_chat_${this.chatIdCounter++}`;
        const messageID = `mock_msg_${this.messageIdCounter++}`;
        const timestamp = new Date();

        this.messages.push({
            ...request,
            id: messageID,
            chatID,
            timestamp,
        });

        return {
            success: true,
            chatID,
            messageID,
            timestamp: timestamp.toISOString(),
        };
    }

    // Helper methods for testing
    getMessages(): Array<
        SaveMessageRequest & { id: string; chatID: string; timestamp: Date }
    > {
        return [...this.messages];
    }

    clearMockData(): void {
        this.messages = [];
        this.messageIdCounter = 1;
        this.chatIdCounter = 1;
    }
}
