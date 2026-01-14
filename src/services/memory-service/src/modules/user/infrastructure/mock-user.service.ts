import { Injectable } from "@nestjs/common";
import { IUserService } from "../domain/user-service.interface";
import { User } from "../domain/user.types";

@Injectable()
export class MockUserService implements IUserService {
    private users: Map<string, User> = new Map();

    constructor() {
        // Initialize with hardcoded test data
        this.initializeMockData();
    }

    private initializeMockData(): void {
        const mockUsers: User[] = [
            {
                id: "user_123",
                name: "John Doe",
                role: "student",
            },
            {
                id: "user_456",
                name: "Jane Smith",
                role: "teacher",
            },
            {
                id: "user_789",
                name: "Alice Johnson",
                role: "student",
            },
        ];

        mockUsers.forEach((user) => this.users.set(user.id, user));
    }

    async findUser(userId: string): Promise<User | null> {
        return this.users.get(userId) || null;
    }
}
