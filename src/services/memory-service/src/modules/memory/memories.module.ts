import { Module } from "@nestjs/common";
import { MemoriesController } from "./memories.controller";
import { MemoriesService } from "./application/services/memories.service";
import { Mem0Service } from "./infrastructure/mem0.service";
import { GoogleCloudMemoryRepository } from "./infrastructure/google-cloud-memory.repository";
import { UserModule } from "../user/user.module";
import { ChatModule } from "../chat/chat.module";


@Module({
  imports: [UserModule, ChatModule],
  controllers: [MemoriesController],
  providers: [
    MemoriesService,
    Mem0Service,
    {
      provide: 'IMemoryRepository',
      useClass: GoogleCloudMemoryRepository,
    },
  ],
  exports: [MemoriesService, Mem0Service],
})
export class MemoriesModule {}
