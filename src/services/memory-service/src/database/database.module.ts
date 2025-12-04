import { Global, Module } from "@nestjs/common";
import { GoogleCloudMemoryRepository } from "./google-cloud-memory.repository";

@Global()
@Module({
  providers: [GoogleCloudMemoryRepository],
  exports: [GoogleCloudMemoryRepository],
})
export class DatabaseModule {}