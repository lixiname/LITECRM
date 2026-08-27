import { BadRequestException, Injectable } from '@nestjs/common'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db, type DbClient } from '../common/db/db'
import { administrativeDivisions, salesRegionAreas, salesRegions } from '../common/db/schema'

@Injectable()
export class GeographyService {
  listProvinces() {
    return db
      .select({
        code: administrativeDivisions.code,
        name: administrativeDivisions.name,
        level: administrativeDivisions.level,
        parentCode: administrativeDivisions.parentCode,
      })
      .from(administrativeDivisions)
      .where(
        and(
          eq(administrativeDivisions.level, 'province'),
          eq(administrativeDivisions.isActive, true),
        ),
      )
      .orderBy(asc(administrativeDivisions.sortOrder), asc(administrativeDivisions.code))
  }

  listCities(provinceCode: string) {
    return db
      .select({
        code: administrativeDivisions.code,
        name: administrativeDivisions.name,
        level: administrativeDivisions.level,
        parentCode: administrativeDivisions.parentCode,
      })
      .from(administrativeDivisions)
      .where(
        and(
          eq(administrativeDivisions.level, 'city'),
          eq(administrativeDivisions.parentCode, provinceCode),
          eq(administrativeDivisions.isActive, true),
        ),
      )
      .orderBy(asc(administrativeDivisions.sortOrder), asc(administrativeDivisions.code))
  }

  listSalesRegions() {
    return db
      .select({ id: salesRegions.id, code: salesRegions.code, name: salesRegions.name })
      .from(salesRegions)
      .where(eq(salesRegions.isActive, true))
      .orderBy(asc(salesRegions.sortOrder), asc(salesRegions.name))
  }

  async resolveLocation(
    client: DbClient,
    provinceCode?: string | null,
    cityCode?: string | null,
  ): Promise<{
    provinceCode: string | null
    province: string | null
    cityCode: string | null
    city: string | null
    salesRegionId: string | null
  }> {
    if (!provinceCode && cityCode) throw new BadRequestException('选择城市前必须先选择省份')
    if (!provinceCode) {
      return {
        provinceCode: null,
        province: null,
        cityCode: null,
        city: null,
        salesRegionId: null,
      }
    }

    const codes = cityCode ? [provinceCode, cityCode] : [provinceCode]
    const divisions = await client
      .select()
      .from(administrativeDivisions)
      .where(
        and(
          inArray(administrativeDivisions.code, codes),
          eq(administrativeDivisions.isActive, true),
        ),
      )
    const province = divisions.find(
      (item) => item.code === provinceCode && item.level === 'province',
    )
    if (!province) throw new BadRequestException('省份行政区划不存在或已停用')

    const city = cityCode
      ? divisions.find(
          (item) =>
            item.code === cityCode && item.level === 'city' && item.parentCode === provinceCode,
        )
      : undefined
    if (cityCode && !city) throw new BadRequestException('城市不属于所选省份或已停用')

    const mappedCodes = city ? [city.code, province.code] : [province.code]
    const mappings = await client
      .select({ divisionCode: salesRegionAreas.divisionCode, salesRegionId: salesRegions.id })
      .from(salesRegionAreas)
      .innerJoin(
        salesRegions,
        and(eq(salesRegionAreas.salesRegionId, salesRegions.id), eq(salesRegions.isActive, true)),
      )
      .where(inArray(salesRegionAreas.divisionCode, mappedCodes))
    const cityMapping = city ? mappings.find((item) => item.divisionCode === city.code) : undefined
    const provinceMapping = mappings.find((item) => item.divisionCode === province.code)

    return {
      provinceCode: province.code,
      province: province.name,
      cityCode: city?.code ?? null,
      city: city?.name ?? null,
      salesRegionId: cityMapping?.salesRegionId ?? provinceMapping?.salesRegionId ?? null,
    }
  }
}
