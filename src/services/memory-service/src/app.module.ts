import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MemoriesModule } from "./modules/memory/memories.module";
import { LoggerModule } from "./common/logger/logger.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        LoggerModule,
        HealthModule,
        MemoriesModule,
    ],
})
export class AppModule {}
