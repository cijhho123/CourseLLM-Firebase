import { Injectable } from "@nestjs/common";
import { IUserService } from "../domain/user-service.interface";
import { User, UserRecord, CreateUserData } from "../domain/user.types";

@Injectable()
export class MockUserService implements IUserService {
    private users: Map<string, UserRecord> = new Map();

    constructor() {
        // Initialize with hardcoded test data
        this.initializeMockData();
    }

    private initializeMockData(): void {
        const now = new Date();
        const mockUsers: UserRecord[] = [
            {
                id: "user_123",
                name: "John Doe",
                role: "student",
                createdAt: now,
                updatedAt: now,
            },
            {
                id: "user_456",
                name: "Jane Smith",
                role: "teacher",
                createdAt: now,
                updatedAt: now,
            },
            {
                id: "user_789",
                name: "Alice Johnson",
                role: "student",
                createdAt: now,
                updatedAt: now,
            },
        ];

        mockUsers.forEach((user) => this.users.set(user.id, user));
    }

    async findUser(userId: string): Promise<User | null> {
        const userRecord = this.users.get(userId);
        if (!userRecord) {
            return null;
        }
        return {
            id: userRecord.id,
            name: userRecord.name,
            role: userRecord.role,
        };
    }

    async findUserById(userId: string): Promise<UserRecord | null> {
        return this.users.get(userId) || null;
    }

    async createUser(data: CreateUserData): Promise<UserRecord> {
        const now = new Date();
        const userRecord: UserRecord = {
            id: data.id,
            name: data.name,
            role: data.role,
            createdAt: now,
            updatedAt: now,
        };
        this.users.set(data.id, userRecord);
        return userRecord;
    }

    async registerUser(data: CreateUserData): Promise<UserRecord> {
        const existing = this.users.get(data.id);
        if (existing) {
            return existing;
        }
        return this.createUser(data);
    }
}
