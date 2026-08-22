import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // 全局前缀 /api：Nginx 反代约定（规格 §9.2）
  app.setGlobalPrefix('api')
  app.enableCors()

  // 全局 DTO 校验（规格 §6.3：每接口必配 class-validator DTO）
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  )

  // Swagger 文档 → openapi.json → 契约生成（规格 §10 Contract-First）
  const config = new DocumentBuilder()
    .setTitle('Lite CRM API')
    .setDescription('面向小团队 B2B 外勤 CRM；契约类型唯一来源见 packages/contracts')
    .setVersion('1.0')
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  await app.listen(process.env.PORT ?? 3001)
}

void bootstrap()
