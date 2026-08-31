import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { eq, sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { seedAccounts } from '../../scripts/seed'
import { AppModule } from '../app.module'
import { db } from '../common/db/db'
import {
  customerClaimRequests,
  customers,
  followUpActions,
  managementComments,
  users,
} from '../common/db/schema'

describe('M5 实时提醒与已读状态', () => {
  let app: INestApplication

  beforeAll(async () => {
    await seedAccounts()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  beforeEach(cleanup)
  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  async function userId(username: string) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.username, username))
    return user.id
  }

  async function login(username: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password: 'Crm@123456' })
    expect(response.status).toBe(200)
    return response.body.accessToken as string
  }

  it('个人逾期与指导意见实时派生，可标记已读；经理只收到管理范围内审批', async () => {
    const [sales1Id, sales2Id, managerId] = await Promise.all([
      userId('sales1'),
      userId('sales2'),
      userId('manager'),
    ])
    const [customer] = await db
      .insert(customers)
      .values({
        name: 'M5_ALERT_客户',
        normalizedKey: 'm5_alert_客户',
        ownerId: sales1Id,
        createdById: sales1Id,
      })
      .returning()
    const [action] = await db
      .insert(followUpActions)
      .values({
        ownerId: sales1Id,
        customerId: customer.id,
        planKind: 'customer_visit',
        originType: 'manual',
        plannedAt: '2026-01-01',
        content: '逾期拜访提醒',
      })
      .returning()
    const [comment] = await db
      .insert(managementComments)
      .values({
        targetType: 'follow_up_action',
        targetId: action.id,
        ownerId: sales1Id,
        authorId: managerId,
        content: '请优先跟进该客户',
      })
      .returning()
    const [claim] = await db
      .insert(customerClaimRequests)
      .values({
        customerId: customer.id,
        applicantId: sales2Id,
        currentOwnerId: sales1Id,
        reason: '客户已由我重新建立联系',
      })
      .returning()

    const sales1Token = await login('sales1')
    const salesAlerts = await request(app.getHttpServer())
      .get('/api/alerts')
      .set('Authorization', `Bearer ${sales1Token}`)
    expect(salesAlerts.status).toBe(200)
    expect(salesAlerts.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: `overdue-action:${action.id}`, read: false }),
        expect.objectContaining({
          key: `management-comment:${comment.id}`,
          targetId: action.id,
          customerId: customer.id,
          read: false,
        }),
      ]),
    )

    const read = await request(app.getHttpServer())
      .post('/api/alerts/read')
      .set('Authorization', `Bearer ${sales1Token}`)
      .send({ key: `management-comment:${comment.id}` })
    expect(read.status).toBe(201)

    const afterRead = await request(app.getHttpServer())
      .get('/api/alerts')
      .set('Authorization', `Bearer ${sales1Token}`)
    expect(
      afterRead.body.items.find(
        (item: { key: string }) => item.key === `management-comment:${comment.id}`,
      ).read,
    ).toBe(true)

    const managerToken = await login('manager')
    const managerAlerts = await request(app.getHttpServer())
      .get('/api/alerts')
      .set('Authorization', `Bearer ${managerToken}`)
    expect(managerAlerts.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: `claim-review:${claim.id}` })]),
    )
  })

  async function cleanup() {
    await db.execute(sql`DELETE FROM alert_reads WHERE alert_key LIKE '%M5_ALERT%'`).catch(() => {})
    await db
      .execute(
        sql`DELETE FROM alert_reads WHERE alert_key LIKE 'overdue-action:%' OR alert_key LIKE 'management-comment:%' OR alert_key LIKE 'claim-review:%'`,
      )
      .catch(() => {})
    await db
      .execute(sql`DELETE FROM management_comments WHERE content LIKE '请优先跟进%'`)
      .catch(() => {})
    await db
      .execute(
        sql`DELETE FROM customer_claim_requests WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'M5_ALERT_%')`,
      )
      .catch(() => {})
    await db
      .execute(
        sql`DELETE FROM follow_up_actions WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'M5_ALERT_%')`,
      )
      .catch(() => {})
    await db.execute(sql`DELETE FROM customers WHERE name LIKE 'M5_ALERT_%'`).catch(() => {})
  }
})
