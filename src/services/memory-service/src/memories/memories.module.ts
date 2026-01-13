import { Module } from "@nestjs/common";
import { MemoriesController } from "./memories.controller";
import { MemoriesService } from "./memories.service";
import { Mem0Service } from "./mem0.service";
import {
    MockChatService,
    MockUserService,
    MockMessageService,
} from "../common/mocks";

@Module({
    controllers: [MemoriesController],
    providers: [
        MemoriesService,
        Mem0Service,
        {
            provide: "IChatService",
            useClass: MockChatService,
        },
        {
            provide: "IUserService",
            useClass: MockUserService,
        },
        {
            provide: "IMessageService",
            useClass: MockMessageService,
        },
    ],
    exports: [MemoriesService, Mem0Service],
})
export class MemoriesModule {}
