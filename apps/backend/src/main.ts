import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { API_PREFIX } from './common/constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  app.enableCors({
    origin: (config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CrowdPulse Ticketing API')
    .setDescription('REST API untuk sistem ticketing CrowdPulse')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(config.get('PORT') ?? 3000);
  // 0.0.0.0 agar dapat diakses HP fisik lewat IP LAN (dipakai di Tahap 5).
  await app.listen(port, '0.0.0.0');
}
bootstrap();
