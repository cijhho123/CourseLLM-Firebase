import { CreateMemoryData, MemoryRecord, MemorySummary } from "./memory.types";

export interface IMemoryRepository {
  create(data: CreateMemoryData): Promise<MemoryRecord>;
  findByUserId(userId: string): Promise<MemorySummary[]>;
}
