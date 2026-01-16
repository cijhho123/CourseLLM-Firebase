import { Module, forwardRef } from "@nestjs/common";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./application/services/messages.service";
import { GoogleCloudMessageRepository } from "./infrastructure/google-cloud-message.repository";
import { ChatModule } from "../chat/chat.module";
import { LoggerModule } from "../../common/logger/logger.module";

@Module({
  imports: [forwardRef(() => ChatModule), LoggerModule],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    {
      provide: "IMessageRepository",
      useClass: GoogleCloudMessageRepository,
    },
  ],
  exports: [MessagesService, "IMessageRepository"],
})
export class MessagesModule {}
