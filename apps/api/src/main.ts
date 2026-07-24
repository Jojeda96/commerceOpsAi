import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  const config = new DocumentBuilder()
    .setTitle('CommerceOps AI API')
    .setDescription('Plataforma multiagente para análisis operacional de e-commerce')
    .setVersion('0.1.0')
    .addTag('Investigations', 'Gestión de investigaciones multiagente')
    .addTag('Analytics', 'Consultas deterministas de negocio')
    .addTag('Models', 'Modelos predictivos y ML')
    .addTag('Simulation', 'Simulador temporal y alertas')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`💻 Dashboard Web (Frontend) disponible en http://localhost:3000`);
  console.log(`🚀 CommerceOps AI API Gateway disponible en http://localhost:${port}/api`);
  console.log(`📚 Documentación Swagger en http://localhost:${port}/api/docs`);
}

bootstrap();
