import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import { CustomLoggerService } from "./common/logger/logger.service";

async function bootstrap() {
  // Set Data Connect emulator host if not already set (for local development)
  if (!process.env.DATA_CONNECT_EMULATOR_HOST && process.env.NODE_ENV !== "production") {
    process.env.DATA_CONNECT_EMULATOR_HOST = "127.0.0.1:9399";
  }

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Set up custom logger
  const logger = app.get(CustomLoggerService);
  logger.setContext("Bootstrap");
  app.useLogger(logger);

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS
  app.enableCors();
  logger.info("CORS enabled");

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle("Memory Service API")
    .setDescription("Student Memory Service for CourseWise platform")
    .setVersion("1.0")
    .addTag("memories", "Memory synthesis with mem0.ai")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);
  logger.info("Swagger documentation configured at /api/docs");

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.info(`Memory Service started successfully on port ${port}`);
  logger.info(`Swagger docs available at http://localhost:${port}/api/docs`);
}
bootstrap();
