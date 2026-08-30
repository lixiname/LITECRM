import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from '../src/app.module'

/**
 * 契约生成（规格 §10 Contract-First）：
 * 后端 DTO → Swagger 文档 → openapi.json（提交入库）→ openapi-typescript 生成契约类型
 * 运行：pnpm --filter @crm/api generate:openapi
 */
async function generate() {
  const app = await NestFactory.create(AppModule, { logger: ['error'], abortOnError: false })
  const config = new DocumentBuilder().setTitle('Lite CRM API').setVersion('1.0').build()
  const document = SwaggerModule.createDocument(app, config)
  const output = resolve(__dirname, '../../../packages/contracts/openapi.json')
  writeFileSync(output, JSON.stringify(document, null, 2), 'utf-8')
  console.log(`openapi.json 已生成 → ${output}`)
  await app.close()
}

void generate().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
