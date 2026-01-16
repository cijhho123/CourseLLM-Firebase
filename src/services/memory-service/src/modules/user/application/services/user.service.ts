import { Injectable, Inject } from "@nestjs/common";
import { CustomLoggerService } from "../../../../common/logger/logger.service";
import { IUserService, IUserRepository } from "../../domain/user-service.interface";
import { User, UserRecord, CreateUserData } from "../../domain/user.types";

@Injectable()
export class UserService implements IUserService {
    constructor(
        @Inject("IUserRepository")
        private readonly userRepository: IUserRepository,
        private readonly logger: CustomLoggerService
    ) {
        this.logger.setContext("UserService");
    }

    async findUser(userId: string): Promise<User | null> {
        const userRecord = await this.userRepository.findById(userId);
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
        return this.userRepository.findById(userId);
    }

    async createUser(data: CreateUserData): Promise<UserRecord> {
        return this.userRepository.create(data);
    }

    /**
     * Register a user (idempotent - returns existing user if found)
     */
    async registerUser(data: CreateUserData): Promise<UserRecord> {
        // Check if user already exists
        const existingUser = await this.userRepository.findById(data.id);
        
        if (existingUser) {
            this.logger.info(`User ${data.id} already exists, returning existing user`);
            return existingUser;
        }

        // Create new user
        const newUser = await this.userRepository.create(data);
        this.logger.info(`User ${data.id} registered successfully`);
        return newUser;
    }
}
