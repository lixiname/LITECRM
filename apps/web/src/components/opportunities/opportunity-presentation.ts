import {
  OPPORTUNITY_QUOTE_KIND_OPTIONS,
  OPPORTUNITY_INITIAL_AMOUNT_BASIS_OPTIONS,
  OPPORTUNITY_QUOTE_STATUS_OPTIONS,
  OPPORTUNITY_STAGE_OPTIONS,
  type OpportunityQuoteKind,
  type OpportunityInitialAmountBasis,
  type OpportunityQuoteStatus,
  type OpportunityStage,
} from '@crm/domain'

export function opportunityStageLabel(stage: OpportunityStage | string | undefined): string {
  return OPPORTUNITY_STAGE_OPTIONS.find((item) => item.value === stage)?.label ?? stage ?? '-'
}

export function opportunityStageTag(
  stage: OpportunityStage,
): 'success' | 'warning' | 'info' | 'danger' {
  if (stage === 'won') return 'success'
  if (stage === 'lost' || stage === 'demand_disappeared') return 'danger'
  return stage === 'following' ? 'warning' : 'info'
}

export function opportunityQuoteKindLabel(kind: OpportunityQuoteKind | undefined): string {
  return OPPORTUNITY_QUOTE_KIND_OPTIONS.find((item) => item.value === kind)?.label ?? '-'
}

export function opportunityQuoteStatusLabel(status: OpportunityQuoteStatus): string {
  return OPPORTUNITY_QUOTE_STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status
}

export function opportunityAmountText(amount: string | null | undefined): string {
  return amount == null ? '-' : `¥${Number(amount).toLocaleString('zh-CN')}`
}

export function opportunityAmountBasisLabel(
  basis: OpportunityInitialAmountBasis | undefined,
): string {
  return OPPORTUNITY_INITIAL_AMOUNT_BASIS_OPTIONS.find((item) => item.value === basis)?.label ?? '-'
}
