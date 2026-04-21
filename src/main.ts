import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({
    // origin: [
    //   'http://localhost:3000',
    //   'http://localhost:3001',
    //   'https://your-frontend-domain.com',
    // ],
    origin: true,
    // credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Invoice Builder API')
    .setDescription('Invoice management system')
    .setVersion('1.0')
    .addBearerAuth() // 🔐 important for JWT
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
