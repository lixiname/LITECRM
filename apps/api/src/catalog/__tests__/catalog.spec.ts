import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { and, eq } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { seedAccounts } from '../../../scripts/seed'
import { AppModule } from '../../app.module'
import { db } from '../../common/db/db'
import { customerDimensionOptions } from '../../common/db/schema'

describe('字典稳定值与展示名称', () => {
  let app: INestApplication

  beforeAll(async () => {
    await seedAccounts()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  beforeEach(async () => {
    await cleanup()
  })

  afterAll(async () => {
    await cleanup()
    await app?.close()
  })

  async function login(username: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
    expect(response.status).toBe(200)
    return (response.body as { accessToken: string }).accessToken
  }

  async function cleanup(): Promise<void> {
    await db
      .delete(customerDimensionOptions)
      .where(
        and(
          eq(customerDimensionOptions.dimension, 'industry'),
          eq(customerDimensionOptions.name, 'catalog_test_value'),
        ),
      )
  }

  it('保存稳定值和中文展示名，停用后仍可供历史记录解析', async () => {
    const adminToken = await login('admin', 'Admin@123456')
    const salesToken = await login('sales1', 'Crm@123456')

    const created = await request(app.getHttpServer())
      .post('/api/catalog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        dimension: 'industry',
        name: 'catalog_test_value',
        label: '测试行业',
        sortOrder: 99,
      })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      name: 'catalog_test_value',
      label: '测试行业',
      isActive: true,
    })

    const disabled = await request(app.getHttpServer())
      .patch(`/api/catalog/${created.body.id as string}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        version: created.body.version,
        name: 'attempted_change',
        label: '测试行业（更新）',
        isActive: false,
      })
    expect(disabled.status).toBe(200)
    expect(disabled.body).toMatchObject({
      name: 'catalog_test_value',
      label: '测试行业（更新）',
      isActive: false,
    })

    const listed = await request(app.getHttpServer())
      .get('/api/catalog/industry')
      .set('Authorization', `Bearer ${salesToken}`)
    expect(listed.status).toBe(200)
    expect(listed.body).toContainEqual(
      expect.objectContaining({
        name: 'catalog_test_value',
        label: '测试行业（更新）',
        isActive: false,
      }),
    )
  })
})
