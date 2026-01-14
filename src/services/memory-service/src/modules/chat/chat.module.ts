import { Module } from "@nestjs/common";
import { MockChatService } from "./infrastructure/mock-chat.service";

@Module({
  controllers: [],
  providers: [
    { provide: 'IChatService', useClass: MockChatService }, // token mapping here
  ],
  exports: ['IChatService'], // export the token for other modules
})
export class ChatModule {}