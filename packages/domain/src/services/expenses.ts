import type { components } from '@crm/contracts'
import { apiGet, apiPost } from './http'

export type CreateExpenseInput = components['schemas']['CreateExpenseDto']

export interface Expense {
  id: string
  ownerId: string
  expenseDate: string
  tobaccoAlcohol: string | null
  gifts: string | null
  dining: string | null
  entertainment: string | null
  lodging: string | null
  notes: string | null
  status: string
  version: number
  updatedAt: string
  createdAt: string
}

/** 保存/更新当日费用（§8.8 upsert） */
export function upsertExpense(dto: CreateExpenseInput): Promise<Expense> {
  return apiPost<Expense>('/expenses', dto)
}

/** 我的费用（按月筛选） */
export function listExpenses(month?: string): Promise<Expense[]> {
  return apiGet<Expense[]>(`/expenses${month ? `?month=${month}` : ''}`)
}

/** 提交（计入统计） */
export function submitExpense(id: string, version: number): Promise<Expense> {
  return apiPost<Expense>(`/expenses/${id}/submit`, { version })
}

/** 作废（剔除统计，留痕） */
export function voidExpense(id: string, version: number): Promise<Expense> {
  return apiPost<Expense>(`/expenses/${id}/void`, { version })
}
