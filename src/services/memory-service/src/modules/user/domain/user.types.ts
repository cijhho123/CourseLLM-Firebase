export interface User {
    id: string;
    name: string;
    role: string;
}

export interface UserRecord {
    id: string;
    name: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateUserData {
    id: string;
    name: string;
    role: string;
}
