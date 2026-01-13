import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import {
  IMemoryRepository,
  CreateMemoryData,
  MemoryRecord,
  MemorySummary,
} from "../common/interfaces/memory-repository.interface";

@Injectable()
export class PrismaMemoryRepository implements IMemoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateMemoryData): Promise<MemoryRecord> {
    return this.prisma.memory.create({
      data: {
        userId: data.userId,
        content: data.content,
        mem0MemoryId: data.mem0MemoryId,
        sourceChatIds: data.sourceChatIds,
      },
    });
  }

  async findByUserId(userId: string): Promise<MemorySummary[]> {
    return this.prisma.memory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        sourceChatIds: true,
      },
    });
  }
}

