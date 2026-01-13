export interface MemoryRecord {
  id: string;
  userId: string;
  content: string;
  mem0MemoryId: string | null;
  sourceChatIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMemoryData {
  userId: string;
  content: string;
  mem0MemoryId?: string;
  sourceChatIds: string[];
}

export interface MemorySummary {
  id: string;
  content: string;
  createdAt: Date;
  sourceChatIds: string[];
}

export interface IMemoryRepository {
  create(data: CreateMemoryData): Promise<MemoryRecord>;
  findByUserId(userId: string): Promise<MemorySummary[]>;
}
