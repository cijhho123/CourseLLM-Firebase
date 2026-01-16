import { User, UserRecord, CreateUserData } from "./user.types";

export interface IUserRepository {
    create(data: CreateUserData): Promise<UserRecord>;
    findById(userId: string): Promise<UserRecord | null>;
}

export interface IUserService {
    findUser(userId: string): Promise<User | null>;
    findUserById(userId: string): Promise<UserRecord | null>;
    createUser(data: CreateUserData): Promise<UserRecord>;
    registerUser(data: CreateUserData): Promise<UserRecord>;
}
