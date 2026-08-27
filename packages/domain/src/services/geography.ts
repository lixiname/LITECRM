import { apiGet } from './http'

export interface AdministrativeDivision {
  code: string
  name: string
  level: 'province' | 'city'
  parentCode: string | null
}

export interface SalesRegion {
  id: string
  code: string
  name: string
}

export function listProvinces(): Promise<AdministrativeDivision[]> {
  return apiGet('/geography/provinces')
}

export function listCities(provinceCode: string): Promise<AdministrativeDivision[]> {
  return apiGet(`/geography/provinces/${provinceCode}/cities`)
}

export function listSalesRegions(): Promise<SalesRegion[]> {
  return apiGet('/geography/sales-regions')
}
