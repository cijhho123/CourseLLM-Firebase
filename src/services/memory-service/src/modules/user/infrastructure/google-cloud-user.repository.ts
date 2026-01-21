import { Injectable, OnModuleInit } from "@nestjs/common";
import { CustomLoggerService } from "../../../common/logger/logger.service";
import { IUserRepository } from "../domain/user-service.interface";
import { UserRecord, CreateUserData } from "../domain/user.types";

@Injectable()
export class GoogleCloudUserRepository
  implements IUserRepository, OnModuleInit
{
  private dataConnectModule: any;

  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext("GoogleCloudUserRepository");
  }

  async onModuleInit() {
    const dataConnectPath = require.resolve("@dataconnect/admin-generated");
    this.logger.info(`Data Connect module found at: ${dataConnectPath}`);
    
    const firebaseAdmin = require("firebase-admin");
    
    if (firebaseAdmin.apps.length === 0) {
      firebaseAdmin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT || "studio-5809901912-20ea0",
      });
      this.logger.info("Firebase Admin SDK initialized with project ID");
    }
    
    this.dataConnectModule = await import("@dataconnect/admin-generated");
    this.logger.info("Firebase Data Connect initialized");
  }

  async create(data: CreateUserData): Promise<UserRecord> {
    try {
      const result = await this.dataConnectModule.createUser({
        id: data.id,
        name: data.name,
        role: data.role,
      });

      this.logger.info(`Created/updated user ${data.id}`);

      // Fetch the full user record to get timestamps
      const userData = result.data.user_insert;
      const fullUser = await this.findById(userData.id);
      
      if (!fullUser) {
        throw new Error(`Failed to retrieve created user ${userData.id}`);
      }

      return fullUser;
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findById(userId: string): Promise<UserRecord | null> {
    try {
      const result = await this.dataConnectModule.getUserById({ id: userId });

      if (!result.data.user) {
        return null;
      }

      const userData = result.data.user;
      
      // Handle timestamp conversion - Firebase Data Connect returns TimestampString
      const createdAt = userData.createdAt 
        ? (typeof userData.createdAt === 'string' ? new Date(userData.createdAt) : new Date(userData.createdAt))
        : new Date();
      const updatedAt = userData.updatedAt 
        ? (typeof userData.updatedAt === 'string' ? new Date(userData.updatedAt) : new Date(userData.updatedAt))
        : new Date();
      
      return {
        id: userData.id,
        name: userData.name,
        role: userData.role,
        createdAt,
        updatedAt,
      };
    } catch (error) {
      this.logger.error(`Failed to find user: ${error.message}`, error.stack);
      throw error;
    }
  }
}
