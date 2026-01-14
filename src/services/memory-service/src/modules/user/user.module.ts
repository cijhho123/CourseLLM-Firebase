import { Module } from "@nestjs/common";
import { MockUserService } from "./infrastructure/mock-user.service";

@Module({
  controllers: [],
  providers: [
    { provide: 'IUserService', useClass: MockUserService },
  ],
  exports: ['IUserService'],
})
export class UserModule {}