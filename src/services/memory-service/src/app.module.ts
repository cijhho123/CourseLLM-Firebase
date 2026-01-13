import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { MemoriesModule } from "./memories/memories.module";
import { LoggerModule } from "./common/logger/logger.module";
import { HealthModule } from "./health/health.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        LoggerModule,
        HealthModule,
        DatabaseModule,
        MemoriesModule,
    ],
})
export class AppModule {}
