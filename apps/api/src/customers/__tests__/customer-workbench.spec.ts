import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { seedAccounts, seedDimensions } from '../../../scripts/seed'
import { AppModule } from '../../app.module'
import { db } from '../../common/db/db'

describe('客户工作台（资料、联系人、最近活动与时间线）', () => {
  let app: INestApplication
  let token: string

  beforeAll(async () => {
    await seedAccounts()
    await seedDimensions()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'sales1', password: 'Crm@123456' })
    token = login.body.accessToken as string
  })

  beforeEach(cleanup)
  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  async function createCustomer(name: string) {
    const response = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name,
        contacts: [{ name: '首要联系人', phone: '13800004001', isKeyContact: true }],
      })
    expect(response.status).toBe(201)
    return response.body as { id: string }
  }

  it('编辑完整资料后，详情返回新值与递增版本', async () => {
    const customer = await createCustomer('WB_客户资料')
    const before = await request(app.getHttpServer())
      .get(`/api/customers/${customer.id}`)
      .set('Authorization', `Bearer ${token}`)

    const updated = await request(app.getHttpServer())
      .patch(`/api/customers/${customer.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        version: before.body.version,
        province: '江苏省',
        city: '苏州市',
        customerType: 'end_user',
        productLines: ['pump', 'filtration_system'],
        source: 'self_visit',
        notes: '工作台测试',
      })
    expect(updated.status).toBe(200)
    expect(updated.body.version).toBe(before.body.version + 1)

    const detail = await request(app.getHttpServer())
      .get(`/api/customers/${customer.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(detail.body).toMatchObject({
      province: '江苏省',
      city: '苏州市',
      customerType: 'end_user',
      productLines: ['pump', 'filtration_system'],
      source: 'self_visit',
      notes: '工作台测试',
    })
  })

  it('切换首要联系人保持唯一，并阻止删除最后一个电话', async () => {
    const customer = await createCustomer('WB_联系人')
    const before = await request(app.getHttpServer())
      .get(`/api/customers/${customer.id}`)
      .set('Authorization', `Bearer ${token}`)
    const firstId = before.body.contacts[0].id as string

    const onlyPhoneDelete = await request(app.getHttpServer())
      .delete(`/api/customers/contacts/${firstId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(onlyPhoneDelete.status).toBe(400)

    const second = await request(app.getHttpServer())
      .post(`/api/customers/${customer.id}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '新首要联系人', phone: '13800004002', isKeyContact: true })
    expect(second.status).toBe(201)

    const after = await request(app.getHttpServer())
      .get(`/api/customers/${customer.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(
      after.body.contacts.filter((contact: { isKeyContact: boolean }) => contact.isKeyContact),
    ).toHaveLength(1)
    expect(
      after.body.contacts.find((contact: { id: string }) => contact.id === second.body.id)
        .isKeyContact,
    ).toBe(true)

    const removeOld = await request(app.getHttpServer())
      .delete(`/api/customers/contacts/${firstId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(removeOld.status).toBe(200)

    const third = await request(app.getHttpServer())
      .post(`/api/customers/${customer.id}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '并发联系人', phone: '13800004003' })
    expect(third.status).toBe(201)
    const concurrentDelete = await Promise.all([
      request(app.getHttpServer())
        .delete(`/api/customers/contacts/${second.body.id}`)
        .set('Authorization', `Bearer ${token}`),
      request(app.getHttpServer())
        .delete(`/api/customers/contacts/${third.body.id}`)
        .set('Authorization', `Bearer ${token}`),
    ])
    expect(concurrentDelete.map((response) => response.status).sort()).toEqual([200, 400])

    const finalDetail = await request(app.getHttpServer())
      .get(`/api/customers/${customer.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(
      finalDetail.body.contacts.filter((contact: { phone?: string }) => contact.phone?.trim()),
    ).toHaveLength(1)
  })

  it('新增拜访后同步客户最近活动，并进入活动时间线', async () => {
    const customer = await createCustomer('WB_活动时间线')
    const occurredAt = new Date().toISOString()
    const visit = await request(app.getHttpServer())
      .post('/api/visits')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.id,
        occurredAt,
        method: 'offline_visit',
        visitType: 'new_customer',
        businessSituation: '确认扩产计划',
        nextActionAt: '2026-09-15T09:00:00+08:00',
        nextActionContent: '确认扩产设备选型进展',
      })
    expect(visit.status).toBe(201)

    const detail = await request(app.getHttpServer())
      .get(`/api/customers/${customer.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(detail.body.lastActivityAt).toBeTruthy()
    expect(detail.body.timeline[0]).toMatchObject({
      type: 'visit',
      title: '拜访',
      summary: '确认扩产计划',
      targetType: 'customer',
      targetId: customer.id,
    })

    const list = await request(app.getHttpServer())
      .get('/api/customers?keyword=WB_活动时间线')
      .set('Authorization', `Bearer ${token}`)
    expect(list.body.items[0].lastActivityAt).toBeTruthy()
  })

  async function cleanup() {
    const customerFilter = `customer_id IN (SELECT id FROM customers WHERE name LIKE 'WB_%')`
    await db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM follow_up_actions WHERE ${sql.raw(customerFilter)}`)
      await tx.execute(sql`DELETE FROM visit_records WHERE ${sql.raw(customerFilter)}`)
      await tx.execute(sql`DELETE FROM customer_grade_changes WHERE ${sql.raw(customerFilter)}`)
      await tx.execute(sql`DELETE FROM contacts WHERE ${sql.raw(customerFilter)}`)
      await tx.execute(sql`DELETE FROM customers WHERE name LIKE 'WB_%'`)
    })
  }
})
