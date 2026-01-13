export interface User {
    id: string;
    name: string;
    role: string;
}

export interface IUserService {
    findUser(userId: string): Promise<User | null>;
}
