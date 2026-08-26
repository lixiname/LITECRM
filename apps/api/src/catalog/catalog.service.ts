import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '../common/db/db'
import { customerDimensionOptions } from '../common/db/schema'
import type { CustomerDimension } from '../common/constants'
import type { CreateDimensionOptionDto } from './dto/create-dimension-option.dto'
import type { UpdateDimensionOptionDto } from './dto/update-dimension-option.dto'

// 客户维度配置（§7.2：字典，供建档/业务表单下拉；admin 维护）
@Injectable()
export class CatalogService {
  // 字典值存在性校验（业务分类字典化后，各 service 录入时校验 value 已在字典）
  async assertDimensionValue(dimension: CustomerDimension, value: string): Promise<void> {
    const [opt] = await db
      .select({ id: customerDimensionOptions.id })
      .from(customerDimensionOptions)
      .where(
        and(
          eq(customerDimensionOptions.dimension, dimension),
          eq(customerDimensionOptions.name, value),
          eq(customerDimensionOptions.isActive, true),
        ),
      )
      .limit(1)
    if (!opt) throw new BadRequestException(`字典项不存在：${dimension}/${value}`)
  }

  async listAll(): Promise<(typeof customerDimensionOptions.$inferSelect)[]> {
    return db
      .select()
      .from(customerDimensionOptions)
      .orderBy(asc(customerDimensionOptions.dimension), asc(customerDimensionOptions.sortOrder))
  }

  // 返回指定维度全部选项：表单过滤停用项，历史记录仍可解析停用值的展示名
  async listByDimension(
    dimension: CustomerDimension,
  ): Promise<(typeof customerDimensionOptions.$inferSelect)[]> {
    return db
      .select()
      .from(customerDimensionOptions)
      .where(eq(customerDimensionOptions.dimension, dimension))
      .orderBy(asc(customerDimensionOptions.sortOrder))
  }

  async create(dto: CreateDimensionOptionDto) {
    const name = dto.name.trim()
    const label = dto.label.trim()
    const [exists] = await db
      .select({ id: customerDimensionOptions.id })
      .from(customerDimensionOptions)
      .where(
        and(
          eq(customerDimensionOptions.dimension, dto.dimension),
          eq(customerDimensionOptions.name, name),
        ),
      )
      .limit(1)
    if (exists) throw new ConflictException('该维度下已存在相同字典值')

    const [created] = await db
      .insert(customerDimensionOptions)
      .values({ dimension: dto.dimension, name, label, sortOrder: dto.sortOrder ?? 0 })
      .returning()
    return created
  }

  async update(id: string, dto: UpdateDimensionOptionDto) {
    const [existing] = await db
      .select()
      .from(customerDimensionOptions)
      .where(eq(customerDimensionOptions.id, id))
      .limit(1)
    if (!existing) throw new NotFoundException('字典项不存在')

    const [updated] = await db
      .update(customerDimensionOptions)
      .set({
        label: dto.label?.trim() ?? existing.label,
        sortOrder: dto.sortOrder ?? existing.sortOrder,
        isActive: dto.isActive ?? existing.isActive,
      })
      .where(eq(customerDimensionOptions.id, id))
      .returning()
    return updated
  }

  // 删除 = 停用（软删，历史客户上的字典快照不受影响，§7.2 设计约定①）
  async remove(id: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(customerDimensionOptions)
      .where(eq(customerDimensionOptions.id, id))
      .limit(1)
    if (!existing) throw new NotFoundException('字典项不存在')
    await db
      .update(customerDimensionOptions)
      .set({ isActive: false })
      .where(eq(customerDimensionOptions.id, id))
  }
}
