// 可重复执行的业务演示数据；与正式账号/字典 seed 分离，避免生产环境误造业务数据。
// 运行：pnpm db:seed:demo
import { eq } from 'drizzle-orm'
import { db } from '../src/common/db/db'
import {
  complaints,
  contacts,
  customers,
  deals,
  followUpActions,
  opportunities,
  opportunityEvents,
  opportunityFollowUps,
  opportunityQuotes,
  users,
  visitRecords,
} from '../src/common/db/schema'
import { seedAccounts, seedDimensions } from './seed'

const ids = {
  activeCustomer: '10000000-0000-4000-8000-000000000001',
  wonCustomer: '10000000-0000-4000-8000-000000000002',
  stalledCustomer: '10000000-0000-4000-8000-000000000003',
  activeContact: '11000000-0000-4000-8000-000000000001',
  activeContact2: '11000000-0000-4000-8000-000000000002',
  wonContact: '11000000-0000-4000-8000-000000000003',
  stalledContact: '11000000-0000-4000-8000-000000000004',
  visit: '12000000-0000-4000-8000-000000000001',
  activeOpportunity: '13000000-0000-4000-8000-000000000001',
  wonOpportunity: '13000000-0000-4000-8000-000000000002',
  stalledOpportunity: '13000000-0000-4000-8000-000000000003',
  followUp: '14000000-0000-4000-8000-000000000001',
  activeQuote: '15000000-0000-4000-8000-000000000001',
  wonQuote: '15000000-0000-4000-8000-000000000002',
  stalledQuote: '15000000-0000-4000-8000-000000000003',
  deal: '16000000-0000-4000-8000-000000000001',
  complaint: '17000000-0000-4000-8000-000000000001',
  activeAction: '18000000-0000-4000-8000-000000000001',
  complaintAction: '18000000-0000-4000-8000-000000000002',
  activeEvent: '19000000-0000-4000-8000-000000000001',
  wonEvent: '19000000-0000-4000-8000-000000000002',
  stalledEvent: '19000000-0000-4000-8000-000000000003',
} as const

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000)
const dateOnly = (date: Date) => date.toISOString().slice(0, 10)

async function seedDemoBusinessData() {
  await seedAccounts()
  await seedDimensions()
  const [sales] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, 'sales1'))
    .limit(1)
  if (!sales) throw new Error('缺少 sales1 测试账号')

  const activeAt = daysFromNow(-2)
  const wonAt = daysFromNow(-20)
  const stalledAt = daysFromNow(-48)

  await db.transaction(async (tx) => {
    const customerRows = [
      {
        id: ids.activeCustomer,
        name: '演示·苏州清源电子材料有限公司',
        normalizedKey: '苏州清源电子材料',
        customerCode: 'DEMO-CUST-001',
        industry: 'electronics',
        customerType: 'end_user',
        productLines: ['pump', 'filtration_system'],
        province: '江苏省',
        city: '苏州市',
        address: '苏州工业园区星湖街 88 号',
        source: 'self_visit',
        grade: 'A' as const,
        ownerId: sales.id,
        createdById: sales.id,
        firstVisitedAt: daysFromNow(-12),
        lastActivityAt: activeAt,
        notes: '电子材料产线，关注循环水系统稳定性。',
      },
      {
        id: ids.wonCustomer,
        name: '演示·无锡恒流精密制造有限公司',
        normalizedKey: '无锡恒流精密制造',
        customerCode: 'DEMO-CUST-002',
        industry: 'manufacturing',
        customerType: 'end_user',
        productLines: ['pump'],
        province: '江苏省',
        city: '无锡市',
        source: 'referral',
        grade: 'B' as const,
        ownerId: sales.id,
        createdById: sales.id,
        firstDealAt: wonAt,
        lastActivityAt: wonAt,
        notes: '已完成一期泵组更新。',
      },
      {
        id: ids.stalledCustomer,
        name: '演示·杭州绿源新材料有限公司',
        normalizedKey: '杭州绿源新材料',
        customerCode: 'DEMO-CUST-003',
        industry: 'manufacturing',
        customerType: 'end_user',
        productLines: ['filtration_system'],
        province: '浙江省',
        city: '杭州市',
        source: 'exhibition',
        grade: 'C' as const,
        ownerId: sales.id,
        createdById: sales.id,
        lastActivityAt: stalledAt,
        notes: '用于演示“报价后长期无动作”的停滞商机。',
      },
    ]
    for (const row of customerRows) {
      await tx
        .insert(customers)
        .values(row)
        .onConflictDoUpdate({
          target: customers.id,
          set: { ...row, updatedAt: new Date() },
        })
    }

    const contactRows = [
      {
        id: ids.activeContact,
        customerId: ids.activeCustomer,
        name: '张工',
        title: '设备主管',
        phone: '13800001001',
        isKeyContact: true,
      },
      {
        id: ids.activeContact2,
        customerId: ids.activeCustomer,
        name: '陈经理',
        title: '采购经理',
        phone: '13800001002',
        isKeyContact: false,
      },
      {
        id: ids.wonContact,
        customerId: ids.wonCustomer,
        name: '李工',
        title: '生产经理',
        phone: '13800002001',
        isKeyContact: true,
      },
      {
        id: ids.stalledContact,
        customerId: ids.stalledCustomer,
        name: '王工',
        title: '项目工程师',
        phone: '13800003001',
        isKeyContact: true,
      },
    ]
    for (const row of contactRows) {
      await tx
        .insert(contacts)
        .values(row)
        .onConflictDoUpdate({
          target: contacts.id,
          set: { ...row, updatedAt: new Date() },
        })
    }

    await tx
      .insert(visitRecords)
      .values({
        id: ids.visit,
        customerId: ids.activeCustomer,
        ownerId: sales.id,
        occurredAt: daysFromNow(-12),
        method: 'offline_visit',
        visitType: 'new_customer',
        businessSituation: '新建电子材料产线，计划改造循环冷却系统。',
        equipmentSituation: '现有泵组能耗偏高，过滤精度不稳定。',
      })
      .onConflictDoUpdate({ target: visitRecords.id, set: { occurredAt: daysFromNow(-12) } })

    const opportunityRows = [
      {
        id: ids.activeOpportunity,
        customerId: ids.activeCustomer,
        ownerId: sales.id,
        name: '循环冷却水泵及过滤系统改造',
        stage: 'following',
        source: 'self_visit',
        productLine: 'filtration_system',
        estimatedAmount: '380000',
        approximate: true,
        estimateNote: '按当前工况的初步组合估算',
        discoveredDate: dateOnly(daysFromNow(-12)),
        expectedCloseDate: dateOnly(daysFromNow(35)),
        lastFollowUpAt: activeAt,
      },
      {
        id: ids.wonOpportunity,
        customerId: ids.wonCustomer,
        ownerId: sales.id,
        name: '一期泵组节能更新',
        stage: 'won',
        source: 'referral',
        productLine: 'pump',
        estimatedAmount: '600000',
        approximate: false,
        discoveredDate: dateOnly(daysFromNow(-60)),
        expectedCloseDate: dateOnly(wonAt),
        lastFollowUpAt: daysFromNow(-22),
        closedAt: wonAt,
        closeReason: '客户明确下单',
      },
      {
        id: ids.stalledOpportunity,
        customerId: ids.stalledCustomer,
        ownerId: sales.id,
        name: '精密过滤成套设备项目',
        stage: 'following',
        source: 'exhibition',
        productLine: 'filtration_system',
        estimatedAmount: '260000',
        approximate: true,
        estimateNote: '展会沟通后的初始预算',
        discoveredDate: dateOnly(daysFromNow(-70)),
        expectedCloseDate: dateOnly(daysFromNow(-5)),
        lastFollowUpAt: stalledAt,
      },
    ] as const
    for (const row of opportunityRows) {
      await tx
        .insert(opportunities)
        .values(row)
        .onConflictDoUpdate({
          target: opportunities.id,
          set: { ...row, updatedAt: new Date() },
        })
    }

    await tx
      .insert(opportunityFollowUps)
      .values({
        id: ids.followUp,
        opportunityId: ids.activeOpportunity,
        actorId: sales.id,
        occurredAt: activeAt,
        conclusion: '客户确认流量参数，要求补充过滤精度方案。',
        method: 'offline_visit',
      })
      .onConflictDoUpdate({ target: opportunityFollowUps.id, set: { occurredAt: activeAt } })

    const quoteRows = [
      {
        id: ids.activeQuote,
        opportunityId: ids.activeOpportunity,
        actorId: sales.id,
        kind: 'oral',
        quotedAt: daysFromNow(-4),
        amount: '365000',
        status: 'active',
        note: '初步组合价格',
      },
      {
        id: ids.wonQuote,
        opportunityId: ids.wonOpportunity,
        actorId: sales.id,
        kind: 'formal',
        quotedAt: daysFromNow(-25),
        amount: '620000',
        quoteNo: 'DEMO-Q-002',
        status: 'active',
      },
      {
        id: ids.stalledQuote,
        opportunityId: ids.stalledOpportunity,
        actorId: sales.id,
        kind: 'formal',
        quotedAt: stalledAt,
        amount: '255000',
        quoteNo: 'DEMO-Q-003',
        status: 'active',
      },
    ] as const
    for (const row of quoteRows) {
      await tx
        .insert(opportunityQuotes)
        .values(row)
        .onConflictDoUpdate({
          target: opportunityQuotes.id,
          set: { ...row, updatedAt: new Date() },
        })
    }

    await tx
      .insert(deals)
      .values({
        id: ids.deal,
        customerId: ids.wonCustomer,
        ownerId: sales.id,
        occurredAt: wonAt,
        amount: '620000',
        productLine: 'pump',
        sourceOpportunityId: ids.wonOpportunity,
        sourceQuoteId: ids.wonQuote,
        note: '一期项目成交',
      })
      .onConflictDoUpdate({
        target: deals.id,
        set: { occurredAt: wonAt, amount: '620000', updatedAt: new Date() },
      })

    await tx
      .insert(complaints)
      .values({
        id: ids.complaint,
        customerId: ids.activeCustomer,
        ownerId: sales.id,
        occurredAt: daysFromNow(-1),
        type: 'service',
        status: 'registered',
        description: '客户反馈现场安装空间需要再次确认。',
      })
      .onConflictDoUpdate({
        target: complaints.id,
        set: { status: 'registered', updatedAt: new Date() },
      })

    const actionRows = [
      {
        id: ids.activeAction,
        ownerId: sales.id,
        customerId: ids.activeCustomer,
        opportunityId: ids.activeOpportunity,
        sourceType: 'opportunity_follow_up',
        sourceId: ids.followUp,
        plannedAt: daysFromNow(2),
        content: '带技术人员复核过滤精度和安装空间',
        status: 'pending',
      },
      {
        id: ids.complaintAction,
        ownerId: sales.id,
        customerId: ids.activeCustomer,
        complaintId: ids.complaint,
        sourceType: 'complaint',
        sourceId: ids.complaint,
        plannedAt: daysFromNow(1),
        content: '电话确认现场安装尺寸',
        status: 'pending',
      },
    ] as const
    for (const row of actionRows) {
      await tx
        .insert(followUpActions)
        .values(row)
        .onConflictDoUpdate({
          target: followUpActions.id,
          set: { ...row, completedAt: null, cancelReason: null, updatedAt: new Date() },
        })
    }

    const eventRows = [
      {
        id: ids.activeEvent,
        opportunityId: ids.activeOpportunity,
        customerId: ids.activeCustomer,
        actorId: sales.id,
        occurredAt: activeAt,
        type: 'updated',
        payload: { demo: true, followUpId: ids.followUp },
      },
      {
        id: ids.wonEvent,
        opportunityId: ids.wonOpportunity,
        customerId: ids.wonCustomer,
        actorId: sales.id,
        occurredAt: wonAt,
        type: 'stage_changed',
        payload: { demo: true, from: 'following', to: 'won', dealId: ids.deal },
      },
      {
        id: ids.stalledEvent,
        opportunityId: ids.stalledOpportunity,
        customerId: ids.stalledCustomer,
        actorId: sales.id,
        occurredAt: stalledAt,
        type: 'updated',
        payload: { demo: true, quoteId: ids.stalledQuote },
      },
    ] as const
    for (const row of eventRows) {
      await tx
        .insert(opportunityEvents)
        .values(row)
        .onConflictDoUpdate({
          target: opportunityEvents.id,
          set: { occurredAt: row.occurredAt, payload: row.payload },
        })
    }
  })
}

seedDemoBusinessData()
  .then(() => {
    console.log('演示数据完成：3 个客户，覆盖开放商机、成交、停滞报价、行动和客诉')
    process.exit(0)
  })
  .catch((error) => {
    console.error('演示数据失败：', error)
    process.exit(1)
  })
