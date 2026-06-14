import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";
import { requestIdHeaderName, requestIdMiddleware } from "./common/request-id/request-id";

export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const webOrigin = configService.getOrThrow<string>("WEB_ORIGIN");

  app.use(requestIdMiddleware);
  app.enableCors({
    allowedHeaders: ["Authorization", "Content-Type", requestIdHeaderName],
    exposedHeaders: [requestIdHeaderName],
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
}
