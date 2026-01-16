import { Module } from "@nestjs/common";
import { UserController } from "./user.controller";
import { UserService } from "./application/services/user.service";
import { GoogleCloudUserRepository } from "./infrastructure/google-cloud-user.repository";
import { LoggerModule } from "../../common/logger/logger.module";

@Module({
  imports: [LoggerModule],
  controllers: [UserController],
  providers: [
    UserService,
    {
      provide: "IUserRepository",
      useClass: GoogleCloudUserRepository,
    },
    {
      provide: "IUserService",
      useClass: UserService,
    },
  ],
  exports: ["IUserService", "IUserRepository"],
})
export class UserModule {}