import { apiGet, apiPost } from './http'

export type AlertType = 'overdue_action' | 'claim_review' | 'claim_result' | 'management_comment'

export interface AlertItem {
  key: string
  type: AlertType
  title: string
  summary: string
  occurredAt: string
  severity: 'info' | 'warning' | 'danger'
  targetId: string
  customerId?: string
  read: boolean
}

export interface AlertsResult {
  items: AlertItem[]
  unreadCount: number
}

export function listAlerts(): Promise<AlertsResult> {
  return apiGet('/alerts')
}

export function markAlertRead(key: string): Promise<{ key: string; read: true }> {
  return apiPost('/alerts/read', { key })
}
