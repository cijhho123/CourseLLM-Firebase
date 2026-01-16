import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MemoriesModule } from "./modules/memory/memories.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { ChatModule } from "./modules/chat/chat.module";
import { UserModule } from "./modules/user/user.module";
import { LoggerModule } from "./common/logger/logger.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        LoggerModule,
        HealthModule,
        UserModule,
        MemoriesModule,
        MessagesModule,
        ChatModule,
    ],
})
export class AppModule {}
