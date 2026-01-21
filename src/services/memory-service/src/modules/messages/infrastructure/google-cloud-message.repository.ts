import { Injectable, OnModuleInit } from "@nestjs/common";
import { CustomLoggerService } from "../../../common/logger/logger.service";
import { IMessageRepository } from "../domain/message-repository.interface";
import { MessageRecord, CreateMessageData } from "../domain/message.types";

@Injectable()
export class GoogleCloudMessageRepository
  implements IMessageRepository, OnModuleInit
{
  private dataConnectModule: any;

  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext("GoogleCloudMessageRepository");
  }

  async onModuleInit() {
    const dataConnectPath = require.resolve("@dataconnect/admin-generated");
    this.logger.info(`Data Connect module found at: ${dataConnectPath}`);
    
    const firebaseAdmin = require("firebase-admin");
    
    if (firebaseAdmin.apps.length === 0) {
      firebaseAdmin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT || "studio-5809901912-20ea0",
      });
      this.logger.info("Firebase Admin SDK initialized with project ID");
    }
    
    this.dataConnectModule = await import("@dataconnect/admin-generated");
    this.logger.info("Firebase Data Connect initialized");
  }

  async create(data: CreateMessageData): Promise<MessageRecord> {
    try {
      const result = await this.dataConnectModule.createMessage({
        chatId: data.chatId,
        content: data.content,
        sender: data.sender,
        sequenceNumber: data.sequenceNumber,
      });

      this.logger.info(`Created message in chat ${data.chatId}`);

      // The message_insert only returns the key, so we need to fetch the full record
      // We'll get it from the messages list (it should be the most recent one)
      const messages = await this.findMessagesByChatId(data.chatId);
      const createdMessage = messages.find(m => m.sequenceNumber === data.sequenceNumber);
      
      if (!createdMessage) {
        // Fallback: create a record with current timestamp if we can't find it
        const messageData = result.data.message_insert;
        const now = new Date();
        return {
          id: messageData.id,
          chatId: data.chatId,
          content: data.content,
          sender: data.sender,
          sequenceNumber: data.sequenceNumber,
          createdAt: now,
          updatedAt: now,
        };
      }

      return createdMessage;
    } catch (error) {
      this.logger.error(`Failed to create message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findMessagesByChatId(chatId: string): Promise<MessageRecord[]> {
    try {
      const result = await this.dataConnectModule.getMessagesByChatId({
        chatId,
      });

      this.logger.info(`Retrieved ${result.data.messages.length} messages for chat ${chatId}`);

      return result.data.messages.map((message: any) => {
        const createdAt = message.createdAt 
          ? (typeof message.createdAt === 'string' ? new Date(message.createdAt) : new Date(message.createdAt))
          : new Date();
        const updatedAt = message.updatedAt 
          ? (typeof message.updatedAt === 'string' ? new Date(message.updatedAt) : new Date(message.updatedAt))
          : new Date();
        
        return {
          id: message.id,
          chatId: message.chatId,
          content: message.content,
          sender: message.sender,
          sequenceNumber: message.sequenceNumber,
          createdAt,
          updatedAt,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to find messages: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getNextSequenceNumber(chatId: string): Promise<number> {
    try {
      // Get all messages for the chat to determine next sequence number
      const messages = await this.findMessagesByChatId(chatId);
      if (messages.length === 0) {
        return 1;
      }
      // Find the highest sequence number and add 1
      const maxSequence = Math.max(...messages.map(m => m.sequenceNumber));
      return maxSequence + 1;
    } catch (error) {
      this.logger.error(`Failed to get next sequence number: ${error.message}`, error.stack);
      throw error;
    }
  }
}
