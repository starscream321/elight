import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ApiKeyGuard } from "./guards/api-key.guard";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors()
  app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true, // 🔥 обязательно
      }),
  );
  app.useGlobalGuards(app.get(ApiKeyGuard))

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
