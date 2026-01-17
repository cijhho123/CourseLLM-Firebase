import { Module } from "@nestjs/common";
import { MemoriesController } from "./memories.controller";
import { MemoriesService } from "./application/services/memories.service";
import { Mem0Service } from "./infrastructure/mem0.service";
import { UserModule } from "../user/user.module";
import { ChatModule } from "../chat/chat.module";
import { LoggerModule } from "../../common/logger/logger.module"

@Module({
  imports: [UserModule, ChatModule, LoggerModule],
  controllers: [MemoriesController],
  providers: [
    MemoriesService,
    Mem0Service,
  ],
  exports: [MemoriesService, Mem0Service],
})
export class MemoriesModule {}
