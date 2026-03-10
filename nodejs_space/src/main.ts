import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for all origins
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: false,
  });

  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Configure Swagger documentation
  const swaggerPath = 'api-docs';
  
  // Prevent CDN/browser caching of Swagger docs
  app.use(`/${swaggerPath}`, (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  const config = new DocumentBuilder()
    .setTitle('Supabase PDF Generation Service')
    .setDescription('Webhook service that automatically generates PDFs based on Supabase job lifecycle events')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  SwaggerModule.setup(swaggerPath, app, document, {
    customSiteTitle: 'Supabase PDF Service',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 30px 0; }
      .swagger-ui .info .title { color: #2c3e50; font-size: 2em; }
      .swagger-ui { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
      .swagger-ui .opblock .opblock-summary { background: #f7f9fc; border-left: 4px solid #3b82f6; }
      .swagger-ui .opblock.opblock-post .opblock-summary { border-left-color: #10b981; }
      .swagger-ui .btn.execute { background-color: #3b82f6; border-color: #3b82f6; }
      .swagger-ui .btn.execute:hover { background-color: #2563eb; border-color: #2563eb; }
    `,
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Service running on port ${process.env.PORT ?? 3000}`);
  console.log(`API Documentation: http://localhost:${process.env.PORT ?? 3000}/${swaggerPath}`);
}
bootstrap();
