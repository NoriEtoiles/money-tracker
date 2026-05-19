import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import "reflect-metadata";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>("API_PORT");
  const webOrigin = configService.getOrThrow<string>("WEB_ORIGIN");

  app.enableCors({
    allowedHeaders: ["Authorization", "Content-Type"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    origin: webOrigin
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true
    })
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  await app.listen(port);
}

void bootstrap();
