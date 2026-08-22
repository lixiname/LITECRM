/**
 * 双端统一设计令牌。
 * 设计令牌是样式唯一来源——移动端适配禁止手写断点 CSS，样式只走 design-tokens（规格红线 16）。
 */
export const tokens = {
  color: {
    primary: '#1677ff',
    primaryLight: '#e6f4ff',
    success: '#52c41a',
    warning: '#faad14',
    danger: '#ff4d4f',
    textPrimary: '#1f2329',
    textSecondary: '#646a73',
    textDisabled: '#8f959e',
    border: '#dee0e3',
    bgPage: '#f5f6f7',
    bgCard: '#ffffff',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
  fontSize: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '22px',
  },
} as const

export type CrmTokens = typeof tokens
