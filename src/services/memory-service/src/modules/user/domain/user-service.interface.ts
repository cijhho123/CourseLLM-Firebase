import { User } from "./user.types";

export interface IUserService {
    findUser(userId: string): Promise<User | null>;
}
