import { Injectable, OnModuleInit } from "@nestjs/common";
import { CustomLoggerService } from "../common/logger/logger.service";
import {
  IMemoryRepository,
  CreateMemoryData,
  MemoryRecord,
  MemorySummary,
} from "../common/interfaces/memory-repository.interface";
import {
  createMemory,
  getMemoriesByUserId,
} from "@dataconnect/admin-generated";

@Injectable()
export class GoogleCloudMemoryRepository
  implements IMemoryRepository, OnModuleInit
{
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext("GoogleCloudMemoryRepository");
  }

  async onModuleInit() {
    this.logger.info("Firebase Data Connect initialized");
  }

  async create(data: CreateMemoryData): Promise<MemoryRecord> {
    try {
      const result = await createMemory({
        userId: data.userId,
        content: data.content,
        mem0MemoryId: data.mem0MemoryId || null,
        sourceChatIds: data.sourceChatIds,
      });

      this.logger.info(`Created memory for user ${data.userId}`);

      return {
        id: result.data.memory_insert.id,
        userId: data.userId,
        content: data.content,
        mem0MemoryId: data.mem0MemoryId,
        sourceChatIds: data.sourceChatIds,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to create memory: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<MemorySummary[]> {
    try {
      const result = await getMemoriesByUserId({ userId });

      this.logger.info(`Retrieved ${result.data.memories.length} memories for user ${userId}`);

      return result.data.memories.map((memory) => ({
        id: memory.id,
        content: memory.content,
        createdAt: new Date(memory.createdAt),
        sourceChatIds: memory.sourceChatIds,
      }));
    } catch (error) {
      this.logger.error(`Failed to find memories: ${error.message}`, error.stack);
      throw error;
    }
  }
}