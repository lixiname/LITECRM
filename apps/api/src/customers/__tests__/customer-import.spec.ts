import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import ExcelJS from 'exceljs'
import { sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { seedAccounts } from '../../../scripts/seed'
import { AppModule } from '../../app.module'
import { db } from '../../common/db/db'

describe('客户 Excel 冷启动导入', () => {
  let app: INestApplication
  let adminToken: string
  let salesToken: string

  beforeAll(async () => {
    await seedAccounts()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
    adminToken = await login('admin')
    salesToken = await login('sales1')
  })

  beforeEach(cleanup)
  afterAll(async () => {
    await cleanup()
    await app?.close()
  })

  it('管理员可预览并导入历史客户，且文件内重复行不会创建第二个客户', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('客户导入')
    sheet.addRow(['填写说明：第 2 行为字段名称，请从第 3 行开始填写客户数据。'])
    sheet.addRow(['客户名称', 'ERP客户编码', '是否存量客户', 'CRM前累计成交金额'])
    sheet.addRow(['IMPORT_华东泵业有限公司', 'IMPORT-001', '是', 125000])
    sheet.addRow(['IMPORT_华东泵业有限公司', 'IMPORT-002', '否', null])
    sheet.addRow(['IMPORT_新建过滤设备有限公司', 'IMPORT-003', '否', null])
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())

    const uploaded = await request(app.getHttpServer())
      .post('/api/customers/imports')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', buffer, 'customers.xlsx')
    expect(uploaded.status).toBe(201)
    expect(uploaded.body.totalRows).toBe(3)
    expect(uploaded.body.sampleRows[0].rowNumber).toBe(3)

    const preview = await request(app.getHttpServer())
      .post(`/api/customers/imports/${uploaded.body.id}/preview`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        mapping: {
          name: '客户名称',
          customerCode: 'ERP客户编码',
          preCrmDealConfirmed: '是否存量客户',
          preCrmSalesAmount: 'CRM前累计成交金额',
        },
        defaultRelationship: 'per_row',
        targetStatus: 'public',
        dataCutoffOn: '2026-08-01',
      })
    expect(preview.status).toBe(201)
    expect(preview.body).toMatchObject({ readyRows: 2, duplicateRows: 1, failedRows: 0 })
    expect(preview.body.rows[1]).toMatchObject({
      status: 'duplicate',
      error: '导入文件内客户名称重复',
    })

    const committed = await request(app.getHttpServer())
      .post(`/api/customers/imports/${uploaded.body.id}/commit`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(committed.status).toBe(201)
    expect(committed.body).toMatchObject({ importedRows: 2, skippedRows: 1, failedRows: 0 })

    const legacy = await request(app.getHttpServer())
      .get('/api/customers?status=public&keyword=IMPORT_华东泵业')
      .set('Authorization', `Bearer ${adminToken}`)
    const importedLegacyCustomers = legacy.body.items.filter(
      (item: { name: string }) => item.name === 'IMPORT_华东泵业有限公司',
    )
    expect(importedLegacyCustomers).toHaveLength(1)
    expect(importedLegacyCustomers[0]).toMatchObject({
      status: 'public',
      relationshipStage: 'existing_customer',
      preCrmDealConfirmed: true,
      preCrmSalesAmount: '125000.00',
    })

    const detail = await request(app.getHttpServer())
      .get(`/api/customers/${importedLegacyCustomers[0].id}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(detail.body.contacts).toEqual([])
    expect(detail.body.dealSummary).toMatchObject({
      count: 0,
      crmAmount: '0',
      preCrmAmount: '125000.00',
      referenceTotalAmount: '125000.00',
    })
  })

  it('下载模板以第一行说明、第二行表头、第三行数据的结构生成', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/customers/imports/template')
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => callback(null, Buffer.concat(chunks)))
      })
    expect(response.status).toBe(200)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(response.body as ExcelJS.Buffer)
    const sheet = workbook.getWorksheet('客户导入')
    expect(sheet?.getCell('A1').text).toContain('第 2 行为字段名称')
    expect(sheet?.getCell('A2').text).toBe('客户名称')
    expect(sheet?.views[0]).toMatchObject({ state: 'frozen', ySplit: 2 })
  })

  it('继续兼容第一行直接作为表头的旧导入文件', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('客户导入')
    sheet.addRow(['客户名称', '备注'])
    sheet.addRow(['IMPORT_旧模板客户', '第一行表头'])
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())

    const uploaded = await request(app.getHttpServer())
      .post('/api/customers/imports')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', buffer, 'customers.xlsx')
    expect(uploaded.status).toBe(201)
    expect(uploaded.body).toMatchObject({
      totalRows: 1,
      headers: ['客户名称', '备注'],
      suggestedMapping: { name: '客户名称', notes: '备注' },
    })
    expect(uploaded.body.sampleRows[0]).toMatchObject({
      rowNumber: 2,
      rawData: { 客户名称: 'IMPORT_旧模板客户', 备注: '第一行表头' },
    })
  })

  it('销售员无权执行客户批量导入', async () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('客户导入').addRow(['客户名称'])
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
    const response = await request(app.getHttpServer())
      .post('/api/customers/imports')
      .set('Authorization', `Bearer ${salesToken}`)
      .attach('file', buffer, 'customers.xlsx')
    expect(response.status).toBe(403)
  })

  async function login(username: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password: username === 'admin' ? 'Admin@123456' : 'Crm@123456' })
    expect(response.status).toBe(200)
    return response.body.accessToken as string
  }

  async function cleanup() {
    await db.execute(
      sql`DELETE FROM customer_import_rows WHERE batch_id IN (SELECT id FROM customer_import_batches WHERE file_name = 'customers.xlsx')`,
    )
    await db.execute(
      sql`DELETE FROM contacts WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'IMPORT_%')`,
    )
    await db.execute(sql`DELETE FROM customers WHERE name LIKE 'IMPORT_%'`)
    await db.execute(sql`DELETE FROM customer_import_batches WHERE file_name = 'customers.xlsx'`)
  }
})
