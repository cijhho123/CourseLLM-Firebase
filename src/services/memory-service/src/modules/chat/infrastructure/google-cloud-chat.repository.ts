import { Injectable, OnModuleInit } from "@nestjs/common";
import { CustomLoggerService } from "../../../common/logger/logger.service";
import { IChatRepository } from "../domain/chat-service.interface";
import { ChatRecord, CreateChatData } from "../domain/chat.types";

@Injectable()
export class GoogleCloudChatRepository
  implements IChatRepository, OnModuleInit
{
  private dataConnectModule: any;

  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext("GoogleCloudChatRepository");
  }

  async onModuleInit() {
    const dataConnectPath = require.resolve("@dataconnect/admin-generated");
    this.logger.info(`Data Connect module found at: ${dataConnectPath}`);
    
    const firebaseAdminPath = require.resolve("firebase-admin", { 
      paths: [require.resolve("@dataconnect/admin-generated")] 
    });
    this.logger.info(`Firebase Admin resolved at: ${firebaseAdminPath}`);
    
    const firebaseAdmin = require(firebaseAdminPath);
    
    if (firebaseAdmin.apps.length === 0) {
      firebaseAdmin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT || "studio-5809901912-20ea0",
      });
      this.logger.info("Firebase Admin SDK initialized with project ID");
    }
    
    this.dataConnectModule = await import("@dataconnect/admin-generated");
    this.logger.info("Firebase Data Connect initialized");
  }

  async create(data: CreateChatData): Promise<ChatRecord> {
    try {
      const result = await this.dataConnectModule.createChat({
        id: data.id,
        userId: data.userId,
        title: data.title || null,
      });

      this.logger.info(`Created chat ${data.id} for user ${data.userId}`);

      // Fetch the full chat record to get timestamps
      const chatData = result.data.chat_insert;
      const fullChat = await this.findById(chatData.id);
      
      if (!fullChat) {
        throw new Error(`Failed to retrieve created chat ${chatData.id}`);
      }

      return fullChat;
    } catch (error) {
      this.logger.error(`Failed to create chat: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findById(chatId: string): Promise<ChatRecord | null> {
    try {
      const result = await this.dataConnectModule.getChatById({ id: chatId });

      if (!result.data.chat) {
        return null;
      }

      const chatData = result.data.chat;
      
      // Handle timestamp conversion - Firebase Data Connect returns TimestampString
      const createdAt = chatData.createdAt 
        ? (typeof chatData.createdAt === 'string' ? new Date(chatData.createdAt) : new Date(chatData.createdAt))
        : new Date();
      const updatedAt = chatData.updatedAt 
        ? (typeof chatData.updatedAt === 'string' ? new Date(chatData.updatedAt) : new Date(chatData.updatedAt))
        : new Date();
      const lastUpdatedAt = chatData.lastUpdatedAt 
        ? (typeof chatData.lastUpdatedAt === 'string' ? new Date(chatData.lastUpdatedAt) : new Date(chatData.lastUpdatedAt))
        : new Date();
      
      return {
        id: chatData.id,
        userId: chatData.userId,
        title: chatData.title,
        lastUpdatedAt,
        createdAt,
        updatedAt,
      };
    } catch (error) {
      this.logger.error(`Failed to find chat: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findByUserId(userId: string, limit?: number): Promise<ChatRecord[]> {
    try {
      const result = await this.dataConnectModule.getChatsByUserId({
        userId,
        limit: limit || undefined,
      });

      this.logger.info(`Retrieved ${result.data.chats.length} chats for user ${userId}`);

      return result.data.chats.map((chat: any) => {
        const createdAt = chat.createdAt 
          ? (typeof chat.createdAt === 'string' ? new Date(chat.createdAt) : new Date(chat.createdAt))
          : new Date();
        const updatedAt = chat.updatedAt 
          ? (typeof chat.updatedAt === 'string' ? new Date(chat.updatedAt) : new Date(chat.updatedAt))
          : new Date();
        const lastUpdatedAt = chat.lastUpdatedAt 
          ? (typeof chat.lastUpdatedAt === 'string' ? new Date(chat.lastUpdatedAt) : new Date(chat.lastUpdatedAt))
          : new Date();
        
        return {
          id: chat.id,
          userId: chat.userId,
          title: chat.title,
          lastUpdatedAt,
          createdAt,
          updatedAt,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to find chats: ${error.message}`, error.stack);
      throw error;
    }
  }

  async update(
    chatId: string,
    updates: { title?: string; lastUpdatedAt?: Date }
  ): Promise<ChatRecord> {
    try {
      const result = await this.dataConnectModule.updateChat({
        id: chatId,
        title: updates.title || undefined,
        lastUpdatedAt: updates.lastUpdatedAt ? updates.lastUpdatedAt.toISOString() : undefined,
      });

      this.logger.info(`Updated chat ${chatId}`);

      // Fetch the full chat record after update to get timestamps
      const chatData = result.data.chat_update;
      const fullChat = await this.findById(chatData.id);
      
      if (!fullChat) {
        throw new Error(`Failed to retrieve updated chat ${chatData.id}`);
      }

      return fullChat;
    } catch (error) {
      this.logger.error(`Failed to update chat: ${error.message}`, error.stack);
      throw error;
    }
  }
}
