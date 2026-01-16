export interface MessageRecord {
  id: string;
  chatId: string;
  content: string;
  sender: string;
  sequenceNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMessageData {
  chatId: string;
  content: string;
  sender: string;
  sequenceNumber: number;
}
