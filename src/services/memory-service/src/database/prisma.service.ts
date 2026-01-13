import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { CustomLoggerService } from "../common/logger/logger.service";

@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy
{
    constructor(private readonly logger: CustomLoggerService) {
        super();
        this.logger.setContext("PrismaService");
    }

    async onModuleInit() {
        try {
            await this.$connect();
            this.logger.info("Database connected successfully");
        } catch (error) {
            this.logger.error(
                `Failed to connect to database: ${error.message}`,
                error.stack
            );
            throw error;
        }
    }

    async onModuleDestroy() {
        try {
            await this.$disconnect();
            this.logger.info("Database disconnected successfully");
        } catch (error) {
            this.logger.error(
                `Error disconnecting from database: ${error.message}`,
                error.stack
            );
        }
    }
}
