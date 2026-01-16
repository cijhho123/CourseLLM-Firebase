import { Module, forwardRef } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService } from "./application/services/chat.service";
import { GoogleCloudChatRepository } from "./infrastructure/google-cloud-chat.repository";
import { MessagesModule } from "../messages/messages.module";
import { LoggerModule } from "../../common/logger/logger.module";

@Module({
  imports: [forwardRef(() => MessagesModule), LoggerModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    {
      provide: "IChatRepository",
      useClass: GoogleCloudChatRepository,
    },
    {
      provide: "IChatService",
      useClass: ChatService,
    },
  ],
  exports: ["IChatService", "IChatRepository"],
})
export class ChatModule {}