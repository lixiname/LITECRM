import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '../common/db/db'
import { customerDimensionOptions } from '../common/db/schema'
import type { CustomerDimension } from '../common/constants'
import type { CreateDimensionOptionDto } from './dto/create-dimension-option.dto'
import type { UpdateDimensionOptionDto } from './dto/update-dimension-option.dto'

// 客户维度配置（§7.2：5 类字典，供客户建档表单下拉；admin 维护）
@Injectable()
export class CatalogService {
  async listAll(): Promise<(typeof customerDimensionOptions.$inferSelect)[]> {
    return db
      .select()
      .from(customerDimensionOptions)
      .orderBy(asc(customerDimensionOptions.dimension), asc(customerDimensionOptions.sortOrder))
  }

  // 表单下拉用：仅返回指定维度启用的选项（所有登录用户可读）
  async listByDimension(
    dimension: CustomerDimension,
  ): Promise<(typeof customerDimensionOptions.$inferSelect)[]> {
    return db
      .select()
      .from(customerDimensionOptions)
      .where(
        and(
          eq(customerDimensionOptions.dimension, dimension),
          eq(customerDimensionOptions.isActive, true),
        ),
      )
      .orderBy(asc(customerDimensionOptions.sortOrder))
  }

  async create(dto: CreateDimensionOptionDto) {
    const [exists] = await db
      .select({ id: customerDimensionOptions.id })
      .from(customerDimensionOptions)
      .where(
        and(
          eq(customerDimensionOptions.dimension, dto.dimension),
          eq(customerDimensionOptions.name, dto.name),
        ),
      )
      .limit(1)
    if (exists) throw new ConflictException('该维度下已存在同名选项')

    const [created] = await db
      .insert(customerDimensionOptions)
      .values({ dimension: dto.dimension, name: dto.name, sortOrder: dto.sortOrder ?? 0 })
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
        name: dto.name ?? existing.name,
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
