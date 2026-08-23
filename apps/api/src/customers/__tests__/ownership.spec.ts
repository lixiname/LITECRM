import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { eq, sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../../app.module'
import { seedAccounts } from '../../../scripts/seed'
import { db } from '../../common/db/db'
import { customerTransfers, customers, userCapacityOverrides } from '../../common/db/schema'

// 归属治理 + 分级容量（§8.3/§7.2）：真实 DB 端到端
describe('归属治理与分级容量（§8.3）', () => {
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
    await cleanupCustomers()
    await db
      .delete(userCapacityOverrides)
      .where(eq(userCapacityOverrides.userId, await getUserId('sales2')))
  })

  afterAll(async () => {
    await cleanupCustomers()
    await db
      .delete(userCapacityOverrides)
      .where(eq(userCapacityOverrides.userId, await getUserId('sales2')))
    await app?.close()
  })

  async function login(username: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
    expect(res.status).toBe(200)
    return res.body as { accessToken: string }
  }

  async function getUserId(username: string): Promise<string> {
    const rows = await db.execute(sql`SELECT id FROM users WHERE username = ${username}`)
    return (rows.rows[0] as { id: string }).id
  }

  async function createCustomer(token: string, name: string) {
    const res = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, contacts: [{ name: '测试联系人', phone: '13800000001' }] })
    expect(res.status).toBe(201)
    return res.body as { id: string }
  }

  async function cleanupCustomers() {
    await db.execute(
      sql`DELETE FROM customer_transfers WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'SMOKE_%')`,
    )
    await db.execute(
      sql`DELETE FROM contacts WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'SMOKE_%')`,
    )
    await db.execute(sql`DELETE FROM customers WHERE name LIKE 'SMOKE_%'`)
  }

  describe('所有权转移', () => {
    it('owner 移交成功：归属变更 + 移交历史落库', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const customer = await createCustomer(sales1.accessToken, 'SMOKE_移交客户')

      const sales1Id = await getUserId('sales1')
      const sales2Id = await getUserId('sales2')
      const res = await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/transfer`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ toOwnerId: sales2Id, reason: '区域调整' })

      expect(res.status).toBe(201)
      expect(res.body.ownerId).toBe(sales2Id)

      const [row] = await db.select().from(customers).where(eq(customers.id, customer.id)).limit(1)
      expect(row.ownerId).toBe(sales2Id)
      expect(row.ownerId).not.toBe(sales1Id)

      const transfers = await db
        .select()
        .from(customerTransfers)
        .where(eq(customerTransfers.customerId, customer.id))
      expect(transfers).toHaveLength(1)
      expect(transfers[0].fromOwnerId).toBe(sales1Id)
      expect(transfers[0].toOwnerId).toBe(sales2Id)
    })

    it('非 owner/非管理链越权移交 → 404（资源不可见）', async () => {
      const sales2 = await login('sales2', 'Crm@123456')
      const customer = await createCustomer(sales2.accessToken, 'SMOKE_他人客户')

      const managerId = await getUserId('manager')
      // sales2 是 owner，自己转给 manager 成功（被接管方确认允许）
      const res = await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/transfer`)
        .set('Authorization', `Bearer ${sales2.accessToken}`)
        .send({ toOwnerId: managerId, reason: '交还' })
      expect(res.status).toBe(201)

      // sales1 无权限（非 owner/非管理链）→ 数据范围外 404
      const res2 = await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/transfer`)
        .set('Authorization', `Bearer ${(await login('sales1', 'Crm@123456')).accessToken}`)
        .send({ toOwnerId: managerId, reason: '越权' })
      expect(res2.status).toBe(404)
    })
  })
  describe('主动释放与公海认领', () => {
    it('owner 释放到公海：status=public + owner=null', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const customer = await createCustomer(sales1.accessToken, 'SMOKE_释放客户')

      const res = await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/release`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ target: 'pool', reason: '客户流失' })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('public')

      const [row] = await db.select().from(customers).where(eq(customers.id, customer.id)).limit(1)
      expect(row.status).toBe('public')
      expect(row.ownerId).toBeNull()
    })

    it('非 owner 释放 → 404（资源不可见）', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const customer = await createCustomer(sales1.accessToken, 'SMOKE_释放越权')

      const res = await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/release`)
        .set('Authorization', `Bearer ${(await login('sales2', 'Crm@123456')).accessToken}`)
        .send({ target: 'invalid', reason: 'x' })
      expect(res.status).toBe(404)
    })

    it('公海认领成功：owner→本人 status→active', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const sales2 = await login('sales2', 'Crm@123456')
      const customer = await createCustomer(sales1.accessToken, 'SMOKE_认领客户')
      await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/release`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ target: 'pool', reason: '释放' })

      const res = await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/claim`)
        .set('Authorization', `Bearer ${sales2.accessToken}`)
      expect(res.status).toBe(201)
      expect(res.body.ownerId).toBe(await getUserId('sales2'))

      const [row] = await db.select().from(customers).where(eq(customers.id, customer.id)).limit(1)
      expect(row.status).toBe('active')
      expect(row.ownerId).toBe(await getUserId('sales2'))
    })
  })

  describe('分级容量（§7.2）', () => {
    it('指定负责人建档超容量 → 409', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const s2id = await getUserId('sales2')
      await db.insert(userCapacityOverrides).values({ userId: s2id, level: 'C', limit: 1 })
      // sales2 先占满容量
      const s2 = await login('sales2', 'Crm@123456')
      await createCustomer(s2.accessToken, 'SMOKE_容量1')

      // sales1 代录，指定负责人 sales2 → 超限 409
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({
          name: 'SMOKE_容量2',
          ownerId: s2id,
          contacts: [{ phone: '13800000002' }],
        })
      expect(res.status).toBe(409)
    })

    it('移交超目标容量 → 409', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const s2id = await getUserId('sales2')
      await db.insert(userCapacityOverrides).values({ userId: s2id, level: 'C', limit: 1 })
      // sales2 先占满容量
      const s2 = await login('sales2', 'Crm@123456')
      await createCustomer(s2.accessToken, 'SMOKE_容量a')
      // sales1 客户转给 sales2 → 应超限
      const customer = await createCustomer(sales1.accessToken, 'SMOKE_容量b')
      const res = await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/transfer`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ toOwnerId: s2id, reason: 'x' })
      expect(res.status).toBe(409)
    })
  })
})
