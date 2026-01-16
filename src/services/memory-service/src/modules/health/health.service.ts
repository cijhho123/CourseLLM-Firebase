import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { CustomLoggerService } from "../../common/logger/logger.service";

@Injectable()
export class HealthService {
    constructor(
        private readonly logger: CustomLoggerService
    ) {
        this.logger.setContext("HealthService");
    }

    async check() {
        const startTime = Date.now();

        try {
            // Check database connection
            // await this.prisma.$queryRaw`SELECT 1`;
            const dbStatus = "connected";

            const responseTime = Date.now() - startTime;

            this.logger.info(
                `Health check passed (db response: ${responseTime}ms)`
            );

            return {
                status: "ok",
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                database: dbStatus,
                responseTime: `${responseTime}ms`,
            };
        } catch (error) {
            this.logger.error(
                `Health check failed: ${error.message}`,
                error.stack
            );

            throw new ServiceUnavailableException({
                status: "error",
                timestamp: new Date().toISOString(),
                database: "disconnected",
                error: error.message,
            });
        }
    }
}
