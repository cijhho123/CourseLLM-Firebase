import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @Get()
    @ApiOperation({ summary: "Health check endpoint" })
    @ApiResponse({
        status: 200,
        description: "Service is healthy",
        schema: {
            type: "object",
            properties: {
                status: { type: "string", example: "ok" },
                timestamp: {
                    type: "string",
                    example: "2025-11-21T10:30:45.123Z",
                },
                uptime: { type: "number", example: 12345 },
                database: { type: "string", example: "connected" },
            },
        },
    })
    @ApiResponse({ status: 503, description: "Service unavailable" })
    async check() {
        return this.healthService.check();
    }
}
