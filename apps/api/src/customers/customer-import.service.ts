import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import ExcelJS from 'exceljs'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../common/db/db'
import { customerImportBatches, customerImportRows, customers, users } from '../common/db/schema'
import type { AuthUser } from '../auth/auth.service'
import { normalizeBusinessName } from './customer-normalizer'
import { CustomersService, type ImportedCustomerInput } from './customers.service'
import type { CustomerImportField, PreviewCustomerImportDto } from './dto/customer-import.dto'

const MAX_IMPORT_ROWS = 2000
const MAX_HEADER_SCAN_ROWS = 10
const TEMPLATE_EXAMPLE_MARKER = '【示例】'
const TEMPLATE_INSTRUCTION =
  '填写说明：第 2 行为字段名称，请勿删除或修改。红色 * 表示必填或条件必填：客户名称始终必填；选择“逐行指定客户关系”时须填是否存量客户；导入在案客户且未选择默认负责人时须填负责人账号。第 3 行是系统自动忽略的示例，请覆盖、删除或从第 4 行开始填写。'

const HEADER_ALIASES: Record<CustomerImportField, string[]> = {
  name: ['客户名称', '名称', '公司名称', 'name'],
  customerCode: ['ERP客户编码', '客户编码', 'customerCode'],
  unifiedSocialCreditCode: ['统一社会信用代码', '信用代码', 'unifiedSocialCreditCode'],
  province: ['省份', '省', 'province'],
  city: ['城市', '地级市', 'city'],
  address: ['地址', '详细地址', 'address'],
  industry: ['客户行业', '行业', 'industry'],
  subIndustry: ['具体领域', '细分行业', 'subIndustry'],
  customerType: ['客户类型', 'customerType'],
  source: ['客户来源', '来源', 'source'],
  grade: ['客户等级', '等级', 'grade'],
  ownerUsername: ['负责人账号', '负责人', 'ownerUsername'],
  contactName: ['联系人', '联系人姓名', 'contactName'],
  contactPhone: ['联系电话', '联系人电话', '电话', 'contactPhone'],
  preCrmDealConfirmed: ['是否存量客户', 'CRM前已成交', 'preCrmDealConfirmed'],
  preCrmSalesAmount: ['CRM前累计成交金额', '历史成交金额', 'preCrmSalesAmount'],
  notes: ['备注', 'notes'],
}

const TEMPLATE_FIELD_ORDER: CustomerImportField[] = [
  'name',
  'preCrmDealConfirmed',
  'ownerUsername',
  'customerCode',
  'unifiedSocialCreditCode',
  'province',
  'city',
  'address',
  'industry',
  'subIndustry',
  'customerType',
  'source',
  'grade',
  'contactName',
  'contactPhone',
  'preCrmSalesAmount',
  'notes',
]

const TEMPLATE_REQUIRED_FIELDS: Partial<
  Record<CustomerImportField, { kind: 'always' | 'conditional'; note: string }>
> = {
  name: { kind: 'always', note: '始终必填：客户法人主体名称。' },
  preCrmDealConfirmed: {
    kind: 'conditional',
    note: '条件必填：导入设置选择“逐行指定客户关系”时，每行填写“是”或“否”。',
  },
  ownerUsername: {
    kind: 'conditional',
    note: '条件必填：导入在案客户且页面未选择默认负责人时，填写系统中的用户名或显示名。',
  },
}

const TEMPLATE_COLUMN_WIDTHS: Partial<Record<CustomerImportField, number>> = {
  name: 34,
  preCrmDealConfirmed: 18,
  ownerUsername: 22,
  unifiedSocialCreditCode: 24,
  address: 30,
  contactPhone: 18,
  preCrmSalesAmount: 22,
  notes: 34,
}

const TEMPLATE_EXAMPLE_VALUES: Partial<Record<CustomerImportField, string | number>> = {
  name: `${TEMPLATE_EXAMPLE_MARKER}苏州清源环保设备有限公司`,
  preCrmDealConfirmed: '是',
  ownerUsername: '请替换为系统用户名',
  customerCode: 'ERP-EXAMPLE-001',
  unifiedSocialCreditCode: '91320594MA0000000X',
  province: '江苏省',
  city: '苏州市',
  address: '苏州工业园区示例路 88 号',
  grade: 'A',
  contactName: '张工',
  contactPhone: '13800000000',
  preCrmSalesAmount: 120000,
  notes: '示例行会被系统自动忽略，请覆盖或删除',
}

type RawRow = Record<string, string | number | boolean | null>

type ExistingCustomerImportMatch = {
  id: string
  name: string
  normalizedKey: string
  customerCode: string | null
  creditCode: string | null
}

@Injectable()
export class CustomerImportService {
  constructor(private readonly customersService: CustomersService) {}

  async createTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('客户导入')
    const headers = TEMPLATE_FIELD_ORDER.map((field) => HEADER_ALIASES[field][0])
    sheet.columns = TEMPLATE_FIELD_ORDER.map((field) => ({
      key: field,
      width: TEMPLATE_COLUMN_WIDTHS[field] ?? 18,
    }))
    sheet.mergeCells(1, 1, 1, headers.length)
    sheet.getCell('A1').value = TEMPLATE_INSTRUCTION
    sheet.getRow(1).height = 46
    sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true }
    sheet.getRow(1).font = { color: { argb: 'FF7A4F01' } }
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF4D6' },
    }
    const headerRow = sheet.addRow(headers)
    sheet.getRow(2).height = 24
    sheet.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(2).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    sheet.getRow(2).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF315F87' },
    }
    for (const [index, field] of TEMPLATE_FIELD_ORDER.entries()) {
      const requirement = TEMPLATE_REQUIRED_FIELDS[field]
      if (!requirement) continue
      const cell = headerRow.getCell(index + 1)
      cell.value = {
        richText: [
          { text: HEADER_ALIASES[field][0], font: { bold: true, color: { argb: 'FFFFFFFF' } } },
          { text: ' *', font: { bold: true, color: { argb: 'FFFF5C5C' } } },
        ],
      }
      cell.note = requirement.note
    }

    const exampleRow = sheet.addRow(
      TEMPLATE_FIELD_ORDER.map((field) => TEMPLATE_EXAMPLE_VALUES[field] ?? null),
    )
    exampleRow.height = 24
    exampleRow.font = { italic: true, color: { argb: 'FF667085' } }
    exampleRow.alignment = { vertical: 'middle' }
    exampleRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F4F7' },
    }

    const relationshipColumn = sheet.getColumn(
      TEMPLATE_FIELD_ORDER.indexOf('preCrmDealConfirmed') + 1,
    ).letter
    const gradeColumn = sheet.getColumn(TEMPLATE_FIELD_ORDER.indexOf('grade') + 1).letter
    addWorksheetDataValidation(
      sheet,
      `${relationshipColumn}4:${relationshipColumn}${MAX_IMPORT_ROWS + 3}`,
      {
        type: 'list',
        allowBlank: true,
        formulae: ['"是,否"'],
      },
    )
    addWorksheetDataValidation(sheet, `${gradeColumn}4:${gradeColumn}${MAX_IMPORT_ROWS + 3}`, {
      type: 'list',
      allowBlank: true,
      formulae: ['"S,A,B,C"'],
    })
    sheet.views = [{ state: 'frozen', ySplit: 2 }]
    sheet.autoFilter = { from: 'A2', to: `${sheet.getColumn(headers.length).letter}2` }
    const output = await workbook.xlsx.writeBuffer()
    return Buffer.from(output)
  }

  async upload(file: { originalname: string; buffer: Buffer }, actor: AuthUser) {
    if (!file?.buffer?.length) throw new BadRequestException('请选择 Excel 文件')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer)
    const sheet = workbook.worksheets[0]
    if (!sheet) throw new BadRequestException('Excel 中没有工作表')
    const headerRowNumber = findHeaderRowNumber(sheet)
    const headers = trimTrailingEmpty(rowValues(sheet.getRow(headerRowNumber)).map(cellText))
    if (headers.length === 0 || headers.some((header) => !header)) {
      throw new BadRequestException('表头行必须是完整的列标题，列标题之间不能留空')
    }
    if (new Set(headers.map(normalizeHeaderLabel)).size !== headers.length)
      throw new BadRequestException('Excel 列标题不能重复')

    const rows: { rowNumber: number; rawData: RawRow }[] = []
    for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const values = rowValues(sheet.getRow(rowNumber))
      const rawData = Object.fromEntries(
        headers.map((header, index) => [header, cellPrimitive(values[index])]),
      ) as RawRow
      if (Object.values(rawData).every((value) => value == null || String(value).trim() === ''))
        continue
      if (isTemplateExampleRow(rawData)) continue
      rows.push({ rowNumber, rawData })
    }
    if (rows.length === 0) throw new BadRequestException('Excel 中没有客户数据')
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(`单次最多导入 ${MAX_IMPORT_ROWS} 行`)
    }

    return db.transaction(async (tx) => {
      const [batch] = await tx
        .insert(customerImportBatches)
        .values({
          fileName: file.originalname,
          defaultRelationship: 'per_row',
          targetStatus: 'public',
          createdById: actor.id,
          totalRows: rows.length,
        })
        .returning()
      await tx.insert(customerImportRows).values(
        rows.map((row) => ({
          batchId: batch.id,
          rowNumber: row.rowNumber,
          rawData: row.rawData,
        })),
      )
      return {
        id: batch.id,
        fileName: batch.fileName,
        headers,
        suggestedMapping: suggestMapping(headers),
        sampleRows: rows.slice(0, 5),
        totalRows: rows.length,
      }
    })
  }

  async preview(batchId: string, dto: PreviewCustomerImportDto, actor: AuthUser) {
    const batch = await this.getOwnedBatch(batchId, actor)
    if (!dto.mapping.name) throw new BadRequestException('必须映射客户名称列')
    if (dto.targetStatus === 'active' && !dto.defaultOwnerId && !dto.mapping.ownerUsername) {
      throw new BadRequestException('导入在案客户时必须选择默认负责人或映射负责人列')
    }
    const importRows = await db
      .select()
      .from(customerImportRows)
      .where(eq(customerImportRows.batchId, batch.id))

    const existing = await db
      .select({
        id: customers.id,
        name: customers.name,
        normalizedKey: customers.normalizedKey,
        customerCode: customers.customerCode,
        creditCode: customers.unifiedSocialCreditCode,
      })
      .from(customers)
    const assignees = await db
      .select({ id: users.id, username: users.username, displayName: users.displayName })
      .from(users)
      .where(and(eq(users.isActive, true), inArray(users.role, ['sales', 'executive'])))
    const assigneeByName = new Map<string, string>()
    for (const assignee of assignees) {
      assigneeByName.set(assignee.username.trim(), assignee.id)
      if (!assigneeByName.has(assignee.displayName.trim())) {
        assigneeByName.set(assignee.displayName.trim(), assignee.id)
      }
    }

    let readyRows = 0
    let duplicateRows = 0
    let failedRows = 0
    const seenNames = new Set<string>()
    const seenCustomerCodes = new Set<string>()
    const seenCreditCodes = new Set<string>()
    const results = []
    for (const row of importRows) {
      const result = normalizeImportRow(row.rawData as RawRow, dto, assigneeByName)
      let status: 'ready' | 'duplicate' | 'invalid' = result.error ? 'invalid' : 'ready'
      let error = result.error
      let duplicateCustomerId: string | null = null
      if (result.data) {
        const duplicate = findDuplicate(existing, result.data)
        if (duplicate) {
          status = 'duplicate'
          duplicateCustomerId = duplicate.customer.id
          error = `${duplicate.reason}：${duplicate.customer.name}`
        } else {
          const batchDuplicate = findBatchDuplicate(
            seenNames,
            seenCustomerCodes,
            seenCreditCodes,
            result.data,
          )
          if (batchDuplicate) {
            status = 'duplicate'
            error = batchDuplicate
          }
        }
      }
      if (status === 'ready' && result.data) {
        readyRows += 1
        seenNames.add(normalizeBusinessName(result.data.name))
        if (result.data.customerCode) seenCustomerCodes.add(result.data.customerCode)
        if (result.data.unifiedSocialCreditCode) {
          seenCreditCodes.add(result.data.unifiedSocialCreditCode)
        }
      } else if (status === 'duplicate') duplicateRows += 1
      else failedRows += 1
      await db
        .update(customerImportRows)
        .set({
          normalizedData: result.data ?? null,
          status,
          error: error ?? null,
          duplicateCustomerId,
        })
        .where(eq(customerImportRows.id, row.id))
      results.push({ rowNumber: row.rowNumber, status, error, data: result.data })
    }

    await db
      .update(customerImportBatches)
      .set({
        status: 'previewed',
        defaultRelationship: dto.defaultRelationship,
        dataCutoffOn: dto.dataCutoffOn ?? null,
        defaultOwnerId: dto.defaultOwnerId ?? null,
        targetStatus: dto.targetStatus,
        readyRows,
        skippedRows: duplicateRows,
        failedRows,
        updatedAt: new Date(),
        version: sql`${customerImportBatches.version} + 1`,
      })
      .where(eq(customerImportBatches.id, batch.id))

    return {
      batchId,
      totalRows: importRows.length,
      readyRows,
      duplicateRows,
      failedRows,
      rows: results,
    }
  }

  async commit(batchId: string, actor: AuthUser) {
    const batch = await this.getOwnedBatch(batchId, actor)
    if (batch.status !== 'previewed') throw new ConflictException('请先完成导入预览')
    const rows = await db
      .select()
      .from(customerImportRows)
      .where(and(eq(customerImportRows.batchId, batch.id), eq(customerImportRows.status, 'ready')))
      .orderBy(customerImportRows.rowNumber)
    await db
      .update(customerImportBatches)
      .set({ status: 'importing', updatedAt: new Date() })
      .where(eq(customerImportBatches.id, batch.id))

    let importedRows = 0
    let failedRows = batch.failedRows
    for (const row of rows) {
      try {
        const input = row.normalizedData as unknown as ImportedCustomerInput
        const customer = await this.customersService.createImportedCustomer(
          { ...input, importBatchId: batch.id },
          actor,
        )
        importedRows += 1
        await db
          .update(customerImportRows)
          .set({ status: 'imported', customerId: customer.id, error: null })
          .where(eq(customerImportRows.id, row.id))
      } catch (error) {
        failedRows += 1
        await db
          .update(customerImportRows)
          .set({ status: 'failed', error: errorMessage(error) })
          .where(eq(customerImportRows.id, row.id))
      }
    }
    await db
      .update(customerImportBatches)
      .set({
        status: 'completed',
        importedRows,
        failedRows,
        completedAt: new Date(),
        updatedAt: new Date(),
        version: sql`${customerImportBatches.version} + 1`,
      })
      .where(eq(customerImportBatches.id, batch.id))
    return { batchId, importedRows, skippedRows: batch.skippedRows, failedRows }
  }

  async get(batchId: string, actor: AuthUser) {
    const batch = await this.getOwnedBatch(batchId, actor)
    const rows = await db
      .select()
      .from(customerImportRows)
      .where(eq(customerImportRows.batchId, batch.id))
      .orderBy(customerImportRows.rowNumber)
    return { ...batch, rows }
  }

  private async getOwnedBatch(batchId: string, actor: AuthUser) {
    const [batch] = await db
      .select()
      .from(customerImportBatches)
      .where(
        and(eq(customerImportBatches.id, batchId), eq(customerImportBatches.createdById, actor.id)),
      )
      .limit(1)
    if (!batch) throw new NotFoundException('导入批次不存在')
    return batch
  }
}

function normalizeImportRow(
  raw: RawRow,
  dto: PreviewCustomerImportDto,
  assigneeByName: Map<string, string>,
): { data?: Omit<ImportedCustomerInput, 'importBatchId'>; error?: string } {
  const value = (field: CustomerImportField) => {
    const header = dto.mapping[field]
    const rawValue = header ? raw[header] : null
    return rawValue == null ? '' : String(rawValue).trim()
  }
  const name = value('name')
  if (!name) return { error: '客户名称不能为空' }
  const gradeText = value('grade').toUpperCase()
  if (gradeText && !['S', 'A', 'B', 'C'].includes(gradeText))
    return { error: '客户等级必须是 S/A/B/C' }
  const amountText = value('preCrmSalesAmount').replace(/[,￥¥\s]/g, '')
  if (amountText && (!/^\d+(\.\d{1,2})?$/.test(amountText) || Number(amountText) < 0)) {
    return { error: 'CRM前累计成交金额格式不正确' }
  }

  let preCrmDealConfirmed = dto.defaultRelationship === 'pre_crm_existing'
  if (dto.defaultRelationship === 'per_row') {
    const parsed = parseRelationship(value('preCrmDealConfirmed'))
    if (parsed == null) return { error: '请逐行填写是否存量客户' }
    preCrmDealConfirmed = parsed
  }
  if (amountText && Number(amountText) > 0) preCrmDealConfirmed = true

  const ownerText = value('ownerUsername')
  const ownerId = ownerText ? assigneeByName.get(ownerText) : dto.defaultOwnerId
  if (ownerText && !ownerId) return { error: `负责人不存在或不可承担客户：${ownerText}` }
  if (dto.targetStatus === 'active' && !ownerId) return { error: '在案客户缺少负责人' }

  return {
    data: {
      name,
      customerCode: optional(value('customerCode')),
      unifiedSocialCreditCode: optional(value('unifiedSocialCreditCode')),
      province: optional(value('province')),
      city: optional(value('city')),
      address: optional(value('address')),
      industry: optional(value('industry')),
      subIndustry: optional(value('subIndustry')),
      customerType: optional(value('customerType')),
      source: optional(value('source')),
      grade: (gradeText || 'C') as 'S' | 'A' | 'B' | 'C',
      ownerId: ownerId ?? null,
      status: dto.targetStatus,
      contactName: optional(value('contactName')),
      contactPhone: optional(value('contactPhone')),
      preCrmDealConfirmed,
      preCrmSalesAmount: amountText || null,
      notes: optional(value('notes')),
    },
  }
}

function findDuplicate(
  existing: ExistingCustomerImportMatch[],
  input: Omit<ImportedCustomerInput, 'importBatchId'>,
) {
  const customer = existing.find(
    (item) =>
      (input.customerCode && item.customerCode === input.customerCode) ||
      (input.unifiedSocialCreditCode && item.creditCode === input.unifiedSocialCreditCode) ||
      item.normalizedKey === normalizeBusinessName(input.name),
  )
  if (!customer) return null
  const reason =
    input.customerCode && customer.customerCode === input.customerCode
      ? 'ERP客户编码重复'
      : input.unifiedSocialCreditCode && customer.creditCode === input.unifiedSocialCreditCode
        ? '统一社会信用代码重复'
        : '客户名称高度疑似重复'
  return { customer, reason }
}

function findBatchDuplicate(
  names: Set<string>,
  customerCodes: Set<string>,
  creditCodes: Set<string>,
  input: Omit<ImportedCustomerInput, 'importBatchId'>,
): string | null {
  if (input.customerCode && customerCodes.has(input.customerCode)) {
    return '导入文件内 ERP 客户编码重复'
  }
  if (input.unifiedSocialCreditCode && creditCodes.has(input.unifiedSocialCreditCode)) {
    return '导入文件内统一社会信用代码重复'
  }
  if (names.has(normalizeBusinessName(input.name))) return '导入文件内客户名称重复'
  return null
}

function suggestMapping(headers: string[]): Partial<Record<CustomerImportField, string>> {
  return Object.fromEntries(
    Object.entries(HEADER_ALIASES).flatMap(([field, aliases]) => {
      const header = headers.find((candidate) =>
        aliases.some(
          (alias) => alias.toLowerCase() === normalizeHeaderLabel(candidate).toLowerCase(),
        ),
      )
      return header ? [[field, header]] : []
    }),
  )
}

function findHeaderRowNumber(sheet: ExcelJS.Worksheet): number {
  const scanLimit = Math.min(sheet.rowCount, MAX_HEADER_SCAN_ROWS)
  const candidateRows: { rowNumber: number; values: string[] }[] = []
  for (let rowNumber = 1; rowNumber <= scanLimit; rowNumber += 1) {
    const values = trimTrailingEmpty(rowValues(sheet.getRow(rowNumber)).map(cellText))
    if (values.some(Boolean)) candidateRows.push({ rowNumber, values })
  }
  if (candidateRows.length === 0) throw new BadRequestException('Excel 中没有列标题')

  const nameAliases = new Set(HEADER_ALIASES.name.map((alias) => alias.toLowerCase()))
  const recognized = candidateRows.find(({ values }) =>
    values.some((value) => nameAliases.has(normalizeHeaderLabel(value).toLowerCase())),
  )
  if (recognized) return recognized.rowNumber

  const firstDataLikeRow = candidateRows.find(({ values }) => !isInstructionRow(values))
  if (firstDataLikeRow) return firstDataLikeRow.rowNumber
  throw new BadRequestException('未找到 Excel 列标题，请保留模板中的字段名称行')
}

function isInstructionRow(values: string[]): boolean {
  const nonEmpty = values.filter(Boolean)
  if (nonEmpty.length === 0) return true
  const text = [...new Set(nonEmpty)].join(' ')
  return /^(填写|导入|使用|模板)?说明\s*[:：]/i.test(text)
}

function normalizeHeaderLabel(value: string): string {
  return value.replace(/\s*[＊*]\s*$/, '').trim()
}

function isTemplateExampleRow(rawData: RawRow): boolean {
  return Object.values(rawData).some(
    (value) => typeof value === 'string' && value.trim().startsWith(TEMPLATE_EXAMPLE_MARKER),
  )
}

function addWorksheetDataValidation(
  sheet: ExcelJS.Worksheet,
  range: string,
  validation: ExcelJS.DataValidation,
): void {
  // ExcelJS 运行时支持范围级 dataValidations，但 Worksheet 的公开类型声明遗漏了该属性。
  const worksheet = sheet as ExcelJS.Worksheet & {
    dataValidations: { add(targetRange: string, rule: ExcelJS.DataValidation): void }
  }
  worksheet.dataValidations.add(range, validation)
}

function trimTrailingEmpty(values: string[]): string[] {
  let end = values.length
  while (end > 0 && !values[end - 1]) end -= 1
  return values.slice(0, end)
}

function rowValues(row: ExcelJS.Row): ExcelJS.CellValue[] {
  const values = row.values
  return Array.isArray(values) ? values.slice(1) : []
}

function cellText(value: ExcelJS.CellValue): string {
  return String(cellPrimitive(value) ?? '').trim()
}

function cellPrimitive(value: ExcelJS.CellValue): string | number | boolean | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return value
  if ('result' in value && value.result != null) return cellPrimitive(value.result)
  if ('text' in value) return value.text
  if ('richText' in value) return value.richText.map((item) => item.text).join('')
  return String(value)
}

function parseRelationship(value: string): boolean | null {
  const normalized = value.toLowerCase()
  if (['是', '存量客户', '老客户', 'true', '1', '已成交'].includes(normalized)) return true
  if (['否', '潜在客户', '新客户', 'false', '0', '未成交'].includes(normalized)) return false
  return null
}

function optional(value: string): string | null {
  return value || null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '导入失败'
}
