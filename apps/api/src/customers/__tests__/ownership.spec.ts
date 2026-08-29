import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { eq, sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../../app.module'
import { seedAccounts } from '../../../scripts/seed'
import { db } from '../../common/db/db'
import {
  customerGradeChanges,
  customerTransfers,
  customers,
  followUpActions,
  opportunities,
  userCustomerGradeQuotaOverrides,
} from '../../common/db/schema'

// 归属治理 + 客户分级名额（§8.3/§7.2）：真实 DB 端到端
describe('归属治理与客户分级名额（§8.3）', () => {
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
      .delete(userCustomerGradeQuotaOverrides)
      .where(eq(userCustomerGradeQuotaOverrides.userId, await getUserId('sales1')))
    await db
      .delete(userCustomerGradeQuotaOverrides)
      .where(eq(userCustomerGradeQuotaOverrides.userId, await getUserId('sales2')))
    await db
      .delete(userCustomerGradeQuotaOverrides)
      .where(eq(userCustomerGradeQuotaOverrides.userId, await getUserId('admin')))
  })

  afterAll(async () => {
    await cleanupCustomers()
    await db
      .delete(userCustomerGradeQuotaOverrides)
      .where(eq(userCustomerGradeQuotaOverrides.userId, await getUserId('sales1')))
    await db
      .delete(userCustomerGradeQuotaOverrides)
      .where(eq(userCustomerGradeQuotaOverrides.userId, await getUserId('sales2')))
    await db
      .delete(userCustomerGradeQuotaOverrides)
      .where(eq(userCustomerGradeQuotaOverrides.userId, await getUserId('admin')))
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

  async function createCustomer(token: string, name: string, grade: 'S' | 'A' | 'B' | 'C' = 'C') {
    const res = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, grade, contacts: [{ name: '测试联系人', phone: '13800000001' }] })
    expect(res.status).toBe(201)
    return res.body as { id: string }
  }

  async function cleanupCustomers() {
    await db.execute(
      sql`DELETE FROM follow_up_actions WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'SMOKE_%')`,
    )
    await db.execute(
      sql`DELETE FROM opportunity_events WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'SMOKE_%')`,
    )
    await db.execute(
      sql`DELETE FROM opportunity_product_lines WHERE opportunity_id IN (SELECT id FROM opportunities WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'SMOKE_%'))`,
    )
    await db.execute(
      sql`DELETE FROM opportunity_follow_ups WHERE opportunity_id IN (SELECT id FROM opportunities WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'SMOKE_%'))`,
    )
    await db.execute(
      sql`DELETE FROM opportunity_quotes WHERE opportunity_id IN (SELECT id FROM opportunities WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'SMOKE_%'))`,
    )
    await db.execute(
      sql`DELETE FROM deals WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'SMOKE_%')`,
    )
    await db.execute(
      sql`DELETE FROM opportunities WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'SMOKE_%')`,
    )
    await db.execute(
      sql`DELETE FROM customer_grade_changes WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'SMOKE_%')`,
    )
    await db.execute(
      sql`DELETE FROM customer_transfers WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'SMOKE_%')`,
    )
    await db.execute(
      sql`DELETE FROM contacts WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'SMOKE_%')`,
    )
    await db.execute(sql`DELETE FROM customers WHERE name LIKE 'SMOKE_%'`)
  }

  describe('所有权转移', () => {
    it('移交候选人只返回可承担客户归属的在职销售与经理', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const res = await request(app.getHttpServer())
        .get('/api/customers/assignees')
        .set('Authorization', `Bearer ${sales1.accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: await getUserId('sales1'), role: 'sales' }),
          expect.objectContaining({ id: await getUserId('sales2'), role: 'sales' }),
          expect.objectContaining({ id: await getUserId('manager'), role: 'executive' }),
        ]),
      )
      expect(res.body).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: await getUserId('admin') }),
          expect.objectContaining({ id: await getUserId('assistant') }),
        ]),
      )
    })

    it('不具备归属资格的代录人必须指定在职销售或经理', async () => {
      const admin = await login('admin', 'Admin@123456')
      const withoutOwner = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'SMOKE_代录未指定',
          contacts: [{ name: '测试联系人', phone: '13800000009' }],
        })
      expect(withoutOwner.status).toBe(400)

      const withOwner = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'SMOKE_代录已指定',
          ownerId: await getUserId('sales1'),
          contacts: [{ name: '测试联系人', phone: '13800000009' }],
        })
      expect(withOwner.status).toBe(201)
      expect(withOwner.body.ownerId).toBe(await getUserId('sales1'))
    })

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
      expect(transfers[0]).toMatchObject({
        eventType: 'transferred',
        fromStatus: 'active',
        toStatus: 'active',
      })
    })

    it('不能绕过选择器把客户移交给非销售岗位', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const customer = await createCustomer(sales1.accessToken, 'SMOKE_非法负责人')
      const res = await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/transfer`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ toOwnerId: await getUserId('assistant'), reason: '非法目标' })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('在职销售或经理')
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

    it('释放时自动取消普通拜访计划，并写入明确的系统原因', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const customer = await createCustomer(sales1.accessToken, 'SMOKE_计划取消')
      const [plan] = await db
        .insert(followUpActions)
        .values({
          ownerId: await getUserId('sales1'),
          customerId: customer.id,
          planKind: 'customer_visit',
          originType: 'manual',
          plannedAt: new Date(Date.now() + 86_400_000),
          content: '下次上门拜访',
        })
        .returning()

      const released = await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/release`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ target: 'pool', reason: '暂不由本人维护' })
      expect(released.status).toBe(201)

      const [cancelled] = await db
        .select()
        .from(followUpActions)
        .where(eq(followUpActions.id, plan.id))
      expect(cancelled).toMatchObject({ status: 'cancelled', cancelReason: '客户已放入公海' })
    })

    it('存在开放商机时禁止释放客户', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const customer = await createCustomer(sales1.accessToken, 'SMOKE_开放商机拦截')
      await db.insert(opportunities).values({
        customerId: customer.id,
        ownerId: await getUserId('sales1'),
        name: '仍在推进的需求',
        source: 'self_visit',
      })

      const released = await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/release`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ target: 'pool', reason: '错误释放' })
      expect(released.status).toBe(409)
      expect(released.body.message).toContain('开放商机')
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

      const pool = await request(app.getHttpServer())
        .get('/api/customers?status=public')
        .set('Authorization', `Bearer ${sales2.accessToken}`)
      expect(pool.status).toBe(200)
      expect(pool.body.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: customer.id, status: 'public' })]),
      )

      const cannotVisitBeforeClaim = await request(app.getHttpServer())
        .post('/api/visits')
        .set('Authorization', `Bearer ${sales2.accessToken}`)
        .send({
          customerId: customer.id,
          occurredAt: new Date().toISOString(),
          method: 'offline_visit',
          nextActionAt: new Date(Date.now() + 86_400_000).toISOString(),
          nextActionContent: '再次拜访',
        })
      expect(cannotVisitBeforeClaim.status).toBe(409)
      expect(cannotVisitBeforeClaim.body.message).toContain('仅在案客户')

      const res = await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/claim`)
        .set('Authorization', `Bearer ${sales2.accessToken}`)
      expect(res.status).toBe(201)
      expect(res.body.ownerId).toBe(await getUserId('sales2'))

      const [row] = await db.select().from(customers).where(eq(customers.id, customer.id)).limit(1)
      expect(row.status).toBe('active')
      expect(row.ownerId).toBe(await getUserId('sales2'))

      const detail = await request(app.getHttpServer())
        .get(`/api/customers/${customer.id}`)
        .set('Authorization', `Bearer ${sales2.accessToken}`)
      expect(detail.body.timeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'ownership_event', title: '释放至公海' }),
          expect.objectContaining({ type: 'ownership_event', title: '从公海认领' }),
        ]),
      )
    })

    it('销售不能标记无效；经理可标记并恢复给团队负责人', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const manager = await login('manager', 'Crm@123456')
      const customer = await createCustomer(sales1.accessToken, 'SMOKE_无效恢复')

      const denied = await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/release`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ target: 'invalid', reason: '误操作' })
      expect(denied.status).toBe(403)

      const invalidated = await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/release`)
        .set('Authorization', `Bearer ${manager.accessToken}`)
        .send({ target: 'invalid', reason: '确认无效' })
      expect(invalidated.status).toBe(201)
      expect(invalidated.body.status).toBe('invalid')

      const hiddenFromSales = await request(app.getHttpServer())
        .get('/api/customers?status=invalid')
        .set('Authorization', `Bearer ${sales1.accessToken}`)
      expect(hiddenFromSales.status).toBe(200)
      expect(hiddenFromSales.body.items).toHaveLength(0)

      const visibleToManager = await request(app.getHttpServer())
        .get('/api/customers?status=invalid')
        .set('Authorization', `Bearer ${manager.accessToken}`)
      expect(visibleToManager.body.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: customer.id, status: 'invalid' })]),
      )

      const restored = await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/restore`)
        .set('Authorization', `Bearer ${manager.accessToken}`)
        .send({ toOwnerId: await getUserId('sales1'), reason: '确认仍有经营价值' })
      expect(restored.status).toBe(201)
      expect(restored.body).toMatchObject({ status: 'active', ownerId: await getUserId('sales1') })
    })
  })

  describe('客户分级名额（§7.2）', () => {
    it('指定负责人建档超名额 → 409', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const s2id = await getUserId('sales2')
      // sales2 先占满 C 级名额
      const s2 = await login('sales2', 'Crm@123456')
      await createCustomer(s2.accessToken, 'SMOKE_容量1')
      const cCount = await activeGradeCount(s2id, 'C')
      await db
        .insert(userCustomerGradeQuotaOverrides)
        .values({ userId: s2id, grade: 'C', limit: cCount })

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

    it('移交超目标名额 → 409', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const s2id = await getUserId('sales2')
      // sales2 先占满 C 级名额
      const s2 = await login('sales2', 'Crm@123456')
      await createCustomer(s2.accessToken, 'SMOKE_容量a')
      const cCount = await activeGradeCount(s2id, 'C')
      await db
        .insert(userCustomerGradeQuotaOverrides)
        .values({ userId: s2id, grade: 'C', limit: cCount })
      // sales1 客户转给 sales2 → 应超限
      const customer = await createCustomer(sales1.accessToken, 'SMOKE_容量b')
      const res = await request(app.getHttpServer())
        .post(`/api/customers/${customer.id}/transfer`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ toOwnerId: s2id, reason: 'x' })
      expect(res.status).toBe(409)
    })

    it('名额按客户等级分别计算：C 级已满仍可接收 A 级客户', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const sales2 = await login('sales2', 'Crm@123456')
      const s2id = await getUserId('sales2')
      await createCustomer(sales2.accessToken, 'SMOKE_C级占满', 'C')
      const cCount = await activeGradeCount(s2id, 'C')
      await db
        .insert(userCustomerGradeQuotaOverrides)
        .values({ userId: s2id, grade: 'C', limit: cCount })

      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({
          name: 'SMOKE_A级可建',
          grade: 'A',
          ownerId: s2id,
          contacts: [{ phone: '13800000003' }],
        })

      expect(res.status).toBe(201)
      expect(res.body.grade).toBe('A')
    })

    it('并发占用最后一个名额时仅一条成功', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const sales1Id = await getUserId('sales1')
      const currentCount = await activeGradeCount(sales1Id, 'C')
      await db
        .insert(userCustomerGradeQuotaOverrides)
        .values({ userId: sales1Id, grade: 'C', limit: currentCount + 1 })

      const create = (name: string) =>
        request(app.getHttpServer())
          .post('/api/customers')
          .set('Authorization', `Bearer ${sales1.accessToken}`)
          .send({ name, grade: 'C', contacts: [{ phone: '13800000004' }] })
      const results = await Promise.all([create('SMOKE_并发名额1'), create('SMOKE_并发名额2')])

      expect(results.map((result) => result.status).sort()).toEqual([201, 409])
    })
  })

  describe('名称查重边界', () => {
    it('相同 normalizedKey 仅提示，不阻止两个不同法人建档', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      await createCustomer(sales1.accessToken, 'SMOKE_同名有限公司')
      const second = await createCustomer(sales1.accessToken, 'SMOKE_同名集团')

      const [row] = await db.select().from(customers).where(eq(customers.id, second.id)).limit(1)
      expect(row.normalizedKey).toBe('smoke_同名')
    })
  })

  describe('客户改级与乐观锁', () => {
    it('改级必须写原因并追加历史；旧版本不能覆盖新版本', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const customer = await createCustomer(sales1.accessToken, 'SMOKE_改级客户')
      const [before] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customer.id))
        .limit(1)

      const missingReason = await request(app.getHttpServer())
        .patch(`/api/customers/${customer.id}`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ version: before.version, grade: 'A' })
      expect(missingReason.status).toBe(400)

      const changed = await request(app.getHttpServer())
        .patch(`/api/customers/${customer.id}`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ version: before.version, grade: 'A', gradeChangeReason: '重点行业客户' })
      expect(changed.status).toBe(200)
      expect(changed.body.grade).toBe('A')
      expect(changed.body.version).toBe(before.version + 1)

      const history = await db
        .select()
        .from(customerGradeChanges)
        .where(eq(customerGradeChanges.customerId, customer.id))
      expect(history).toHaveLength(1)
      expect(history[0]).toMatchObject({
        fromGrade: 'C',
        toGrade: 'A',
        reason: '重点行业客户',
      })

      const stale = await request(app.getHttpServer())
        .patch(`/api/customers/${customer.id}`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ version: before.version, notes: '覆盖新版本' })
      expect(stale.status).toBe(409)
    })
  })

  async function activeGradeCount(userId: string, grade: 'S' | 'A' | 'B' | 'C') {
    const result = await db.execute(sql`
      SELECT count(*)::int AS count
      FROM customers
      WHERE owner_id = ${userId} AND grade = ${grade} AND status = 'active'
    `)
    return (result.rows[0] as { count: number }).count
  }
})
