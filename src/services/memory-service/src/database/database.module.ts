import { Global, Module } from "@nestjs/common";
import { GoogleCloudMemoryRepository } from "./google-cloud-memory.repository";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}