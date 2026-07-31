import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'ready'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Stripe-Signature'],
  });

  const nodeEnv = configService.get<string>('nodeEnv') || 'development';
  const config = new DocumentBuilder()
    .setTitle('Animify AI API')
    .setDescription(
      'Full AI Video Generator platform — auth, projects, credits, AI jobs, editor, payments, admin',
    )
    .setVersion('2.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('users')
    .addTag('videos')
    .addTag('projects')
    .addTag('credits')
    .addTag('generator')
    .addTag('studio')
    .addTag('voices')
    .addTag('scripts')
    .addTag('images')
    .addTag('editor')
    .addTag('payments')
    .addTag('notifications')
    .addTag('favorites')
    .addTag('admin')
    .addTag('health')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  logger.log('Swagger documentation available at /api/docs');

  // Prefer API_PORT; ignore Redis PORT=6379 if it leaked into the service env.
  const rawPort = process.env.API_PORT || process.env.PORT;
  const portNum = Number(rawPort);
  const port =
    Number.isFinite(portNum) && portNum > 0 && portNum !== 6379
      ? portNum
      : configService.get<number>('port') || 3000;
  await app.listen(port);
  
  logger.log(`Application running on port ${port}`);
  logger.log(`Environment: ${nodeEnv}`);
}

bootstrap();
