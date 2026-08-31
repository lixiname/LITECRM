// 可重复执行的业务演示数据；与正式账号/字典 seed 分离，避免生产环境误造业务数据。
// 运行：pnpm db:seed:demo
import { eq } from 'drizzle-orm'
import { db } from '../src/common/db/db'
import {
  complaints,
  contacts,
  customers,
  dailyExpenses,
  deals,
  followUpActions,
  opportunities,
  opportunityEvents,
  opportunityFollowUps,
  opportunityProductLines,
  opportunityQuotes,
  users,
  visitRecords,
} from '../src/common/db/schema'
import { seedAccounts, seedDimensions, seedGeography } from './seed'

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
  keyCustomer: '10000000-0000-4000-8000-000000000004',
  keyOpportunity: '13000000-0000-4000-8000-000000000004',
  keyQuote: '15000000-0000-4000-8000-000000000004',
  keyAction: '18000000-0000-4000-8000-000000000004',
  keyVisit: '12000000-0000-4000-8000-000000000004',
  sales1Expense: '1a000000-0000-4000-8000-000000000001',
  sales2Expense: '1a000000-0000-4000-8000-000000000002',
} as const

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000)
const dateOnly = (date: Date) => date.toISOString().slice(0, 10)
const businessDaysFromNow = (days: number) => dateOnly(daysFromNow(days))

async function seedDemoBusinessData() {
  await seedAccounts()
  await seedDimensions()
  await seedGeography()
  const salesRows = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.isActive, true))
  const sales = salesRows.find((item) => item.username === 'sales1')
  const sales2 = salesRows.find((item) => item.username === 'sales2')
  if (!sales || !sales2) throw new Error('缺少 sales1/sales2 测试账号')

  const activeAt = businessDaysFromNow(-2)
  const wonAt = businessDaysFromNow(-20)
  const stalledAt = businessDaysFromNow(-48)

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
        firstVisitedAt: businessDaysFromNow(-12),
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
      {
        id: ids.keyCustomer,
        name: '演示·宁波海川储能科技有限公司',
        normalizedKey: '宁波海川储能科技',
        customerCode: 'DEMO-CUST-004',
        industry: 'energy_storage',
        subIndustry: 'hardware',
        customerType: 'end_user',
        productLines: ['filtration_system'],
        province: '浙江省',
        city: '宁波市',
        provinceCode: '330000',
        cityCode: '330200',
        source: 'exhibition',
        grade: 'S' as const,
        ownerId: sales2.id,
        createdById: sales2.id,
        firstVisitedAt: businessDaysFromNow(-35),
        lastActivityAt: businessDaysFromNow(-34),
        notes: '用于演示管理层关注的 S 类客户与正式报价逾期。',
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
        occurredAt: businessDaysFromNow(-12),
        method: 'offline_visit',
        visitType: 'new_customer',
        businessSituation: '新建电子材料产线，计划改造循环冷却系统。',
        equipmentSituation: '现有泵组能耗偏高，过滤精度不稳定。',
      })
      .onConflictDoUpdate({
        target: visitRecords.id,
        set: { occurredAt: businessDaysFromNow(-12) },
      })

    const opportunityRows = [
      {
        id: ids.activeOpportunity,
        customerId: ids.activeCustomer,
        ownerId: sales.id,
        name: '循环冷却水泵及过滤系统改造',
        stage: 'following',
        source: 'self_visit',
        initialAmountBasis: 'estimate',
        estimatedAmount: '380000',
        approximate: true,
        estimateNote: '按当前工况的初步组合估算',
        createdAt: daysFromNow(-12),
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
        initialAmountBasis: 'estimate',
        estimatedAmount: '600000',
        approximate: false,
        createdAt: daysFromNow(-60),
        discoveredDate: dateOnly(daysFromNow(-60)),
        expectedCloseDate: wonAt,
        lastFollowUpAt: businessDaysFromNow(-22),
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
        initialAmountBasis: 'estimate',
        estimatedAmount: '260000',
        approximate: true,
        estimateNote: '展会沟通后的初始预算',
        createdAt: daysFromNow(-70),
        discoveredDate: dateOnly(daysFromNow(-70)),
        expectedCloseDate: dateOnly(daysFromNow(-5)),
        lastFollowUpAt: stalledAt,
      },
      {
        id: ids.keyOpportunity,
        customerId: ids.keyCustomer,
        ownerId: sales2.id,
        name: '储能产线过滤系统扩建',
        stage: 'following',
        source: 'exhibition',
        initialAmountBasis: 'formal_quote',
        estimatedAmount: null,
        approximate: false,
        createdAt: daysFromNow(-40),
        discoveredDate: dateOnly(daysFromNow(-40)),
        expectedCloseDate: dateOnly(daysFromNow(20)),
        lastFollowUpAt: businessDaysFromNow(-34),
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
      .insert(opportunityProductLines)
      .values([
        { opportunityId: ids.activeOpportunity, productLine: 'filtration_system' },
        { opportunityId: ids.activeOpportunity, productLine: 'pump' },
        { opportunityId: ids.wonOpportunity, productLine: 'pump' },
        { opportunityId: ids.stalledOpportunity, productLine: 'filtration_system' },
        { opportunityId: ids.keyOpportunity, productLine: 'filtration_system' },
      ])
      .onConflictDoNothing()

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
        quotedAt: businessDaysFromNow(-4),
        amount: '365000',
        status: 'active',
        note: '初步组合价格',
      },
      {
        id: ids.wonQuote,
        opportunityId: ids.wonOpportunity,
        actorId: sales.id,
        kind: 'formal',
        quotedAt: businessDaysFromNow(-25),
        amount: '620000',
        quoteNo: 'DEMO-Q-002',
        status: 'active',
      },
      {
        id: ids.keyQuote,
        opportunityId: ids.keyOpportunity,
        actorId: sales2.id,
        kind: 'formal',
        quotedAt: businessDaysFromNow(-34),
        amount: '880000',
        quoteNo: 'DEMO-Q-004',
        status: 'active',
        note: '等待客户技术委员会确认',
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
        occurredAt: businessDaysFromNow(-1),
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
        planKind: 'opportunity_follow_up',
        originType: 'opportunity_follow_up',
        sourceId: ids.followUp,
        plannedAt: businessDaysFromNow(2),
        content: '带技术人员复核过滤精度和安装空间',
        status: 'pending',
      },
      {
        id: ids.keyAction,
        ownerId: sales2.id,
        customerId: ids.keyCustomer,
        opportunityId: ids.keyOpportunity,
        planKind: 'opportunity_follow_up',
        originType: 'opportunity_quote',
        sourceId: ids.keyQuote,
        plannedAt: businessDaysFromNow(-3),
        content: '确认储能项目正式报价评审结果',
        status: 'pending',
      },
      {
        id: ids.complaintAction,
        ownerId: sales.id,
        customerId: ids.activeCustomer,
        complaintId: ids.complaint,
        planKind: 'complaint_follow_up',
        originType: 'complaint',
        sourceId: ids.complaint,
        plannedAt: businessDaysFromNow(1),
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

    await tx
      .insert(visitRecords)
      .values({
        id: ids.keyVisit,
        customerId: ids.keyCustomer,
        ownerId: sales2.id,
        occurredAt: businessDaysFromNow(-6),
        method: 'offline_visit',
        visitType: 'existing_maintenance',
        businessSituation: '复核扩建产线的过滤系统参数和交付窗口。',
      })
      .onConflictDoUpdate({ target: visitRecords.id, set: { occurredAt: businessDaysFromNow(-6) } })

    const expenseDate = dateOnly(new Date())
    const expenseRows = [
      {
        id: ids.sales1Expense,
        ownerId: sales.id,
        expenseDate,
        dining: '680',
        lodging: '420',
        notes: '苏州客户拜访',
        status: 'submitted',
        submittedAt: new Date(),
      },
      {
        id: ids.sales2Expense,
        ownerId: sales2.id,
        expenseDate,
        gifts: '350',
        dining: '520',
        notes: '宁波重点客户沟通',
        status: 'submitted',
        submittedAt: new Date(),
      },
    ] as const
    for (const row of expenseRows) {
      await tx
        .insert(dailyExpenses)
        .values(row)
        .onConflictDoUpdate({
          target: dailyExpenses.id,
          set: { ...row, updatedAt: new Date() },
        })
    }
  })

  // 客户插入后按省市稳定代码回填销售大区。
  await seedGeography()
}

if (process.env.NODE_ENV === 'production') {
  console.error('正式环境禁止写入演示业务数据。')
  process.exit(1)
}

seedDemoBusinessData()
  .then(() => {
    console.log('演示数据完成：4 个客户，覆盖团队报价池、成交、重点客户风险、行动、客诉和费用')
    process.exit(0)
  })
  .catch((error) => {
    console.error('演示数据失败：', error)
    process.exit(1)
  })
