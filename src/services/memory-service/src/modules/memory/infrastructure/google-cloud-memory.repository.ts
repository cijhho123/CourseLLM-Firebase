import { Injectable, OnModuleInit } from "@nestjs/common";
import { CustomLoggerService } from "../../../common/logger/logger.service";
import {
  IMemoryRepository,
} from "../domain/memory-repository.interface";
import { CreateMemoryData, MemoryRecord, MemorySummary } from "../domain/memory.types";

@Injectable()
export class GoogleCloudMemoryRepository
  implements IMemoryRepository, OnModuleInit
{
  private dataConnectModule: any;

  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext("GoogleCloudMemoryRepository");
  }

  async onModuleInit() {
    // Find where @dataconnect/admin-generated resolves firebase-admin from
    // and initialize THAT instance
    const dataConnectPath = require.resolve("@dataconnect/admin-generated");
    this.logger.info(`Data Connect module found at: ${dataConnectPath}`);
    
    // Resolve firebase-admin from the same location as dataconnect
    const firebaseAdminPath = require.resolve("firebase-admin", { 
      paths: [require.resolve("@dataconnect/admin-generated")] 
    });
    this.logger.info(`Firebase Admin resolved at: ${firebaseAdminPath}`);
    
    const firebaseAdmin = require(firebaseAdminPath);
    
    // Initialize Firebase Admin SDK with project ID (required for emulator)
    if (firebaseAdmin.apps.length === 0) {
      firebaseAdmin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT || "studio-5809901912-20ea0",
      });
      this.logger.info("Firebase Admin SDK initialized with project ID");
    }
    
    // Now load the Data Connect module after Firebase is initialized
    this.dataConnectModule = await import("@dataconnect/admin-generated");
    this.logger.info("Firebase Data Connect initialized");
  }

  async create(data: CreateMemoryData): Promise<MemoryRecord> {
    try {
      const result = await this.dataConnectModule.createMemory({
        userId: data.userId,
        content: data.content,
        mem0MemoryId: data.mem0MemoryId || null,
        sourceChatIds: data.sourceChatIds,
      });

      this.logger.info(`Created memory for user ${data.userId}`);

      // Fetch the full memory record to get timestamps
      // Note: memory_insert only returns the key, so we need to query for the full record
      const memoryData = result.data.memory_insert;
      
      // Query for the full memory record
      const memories = await this.findByUserId(data.userId);
      const createdMemory = memories.find(m => m.id === memoryData.id);
      
      if (!createdMemory) {
        // Fallback: create a record with current timestamp if we can't find it
        const now = new Date();
        return {
          id: memoryData.id,
          userId: data.userId,
          content: data.content,
          mem0MemoryId: data.mem0MemoryId || null,
          sourceChatIds: data.sourceChatIds,
          createdAt: now,
          updatedAt: now,
        };
      }

      // Convert MemorySummary to MemoryRecord
      return {
        id: createdMemory.id,
        userId: data.userId,
        content: createdMemory.content,
        mem0MemoryId: createdMemory.mem0MemoryId || null,
        sourceChatIds: createdMemory.sourceChatIds,
        createdAt: createdMemory.createdAt,
        updatedAt: createdMemory.createdAt, // Use createdAt as updatedAt fallback
      };
    } catch (error) {
      this.logger.error(`Failed to create memory: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<MemorySummary[]> {
    try {
      const result = await this.dataConnectModule.getMemoriesByUserId({ userId });

      this.logger.info(`Retrieved ${result.data.memories.length} memories for user ${userId}`);

      return result.data.memories.map((memory: any) => {
        const createdAt = memory.createdAt 
          ? (typeof memory.createdAt === 'string' ? new Date(memory.createdAt) : new Date(memory.createdAt))
          : new Date();
        
        return {
          id: memory.id,
          content: memory.content,
          createdAt,
          sourceChatIds: memory.sourceChatIds || [],
          mem0MemoryId: memory.mem0MemoryId || null,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to find memories: ${error.message}`, error.stack);
      throw error;
    }
  }
}