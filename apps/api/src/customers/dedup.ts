import jaroWinkler from 'jaro-winkler'
import { pinyin } from 'pinyin-pro'

// 查重管道核心（§8.2 五步的 ④相似度比较 ⑤置信度分级）
// 纯函数，便于单测；DB 侧（候选生成/trigram）在 service 中编排

export type DedupConfidence = 'high' | 'medium' | 'low'

export interface DedupInput {
  /** 原始名称 */
  name: string
  /** 归一化商号 key */
  normalizedKey: string
  /** 归一化后的电话（可无） */
  phone?: string | null
  /** 原始地址（可无，用于地址归一化精确比对） */
  address?: string | null
}

export interface DedupCandidate {
  id: string
  name: string
  normalizedKey: string
  city?: string | null
  address?: string | null
  /** 候选是否因电话精确匹配进入（DB 侧 EXISTS 判定） */
  phoneMatched: boolean
  /** pg_trgm 相似度（DB 侧 similarity()，可无） */
  trigramSimilarity?: number | null
  status?: 'active' | 'public' | 'invalid'
}

export interface DedupScored {
  candidateId: string
  candidateName: string
  candidateCity?: string | null
  confidence: DedupConfidence
  reasons: string[]
  customerStatus?: 'active' | 'public' | 'invalid'
}

// 置信度分级（§8.2 表格）：高=精确类 / 中=trigram≥0.5 或 Jaro≥0.8 / 低=弱相似
export function scoreDuplicate(candidate: DedupCandidate, input: DedupInput): DedupScored | null {
  const reasons: string[] = []
  let high = false
  let medium = false

  // 高：电话精确（候选因电话匹配进入）
  if (candidate.phoneMatched) {
    high = true
    reasons.push('联系人电话相同')
  }

  // 高：商号 key 精确（归一化后完全相等）
  if (candidate.normalizedKey === input.normalizedKey) {
    high = true
    reasons.push('名称归一化后完全相同')
  }

  // 高：拼音相同且字数相同（同音字/繁体）
  const pinyinCandidate = toPinyin(candidate.normalizedKey)
  const pinyinInput = toPinyin(input.normalizedKey)
  if (
    pinyinCandidate &&
    pinyinInput &&
    pinyinCandidate.length > 0 &&
    pinyinCandidate === pinyinInput
  ) {
    high = true
    reasons.push('拼音相同且字数相同')
  }

  // 高：地址归一化精确
  if (
    input.address &&
    candidate.address &&
    normalizeAddress(input.address) === normalizeAddress(candidate.address)
  ) {
    high = true
    reasons.push('地址归一化后相同')
  }

  // 中：trigram ≥ 0.5
  const trigram = candidate.trigramSimilarity ?? 0
  if (!high && trigram >= 0.5) {
    medium = true
    reasons.push(`名称模糊相似 ${trigram.toFixed(2)}`)
  }

  // 中：Jaro-Winkler ≥ 0.8
  const jaro = jaroWinkler(candidate.normalizedKey, input.normalizedKey)
  if (!high && jaro >= 0.8) {
    medium = true
    reasons.push(`名称高度相似 ${jaro.toFixed(2)}`)
  }

  if (high)
    return {
      candidateId: candidate.id,
      candidateName: candidate.name,
      candidateCity: candidate.city,
      confidence: 'high',
      reasons,
      customerStatus: candidate.status,
    }
  if (medium)
    return {
      candidateId: candidate.id,
      candidateName: candidate.name,
      candidateCity: candidate.city,
      confidence: 'medium',
      reasons,
      customerStatus: candidate.status,
    }

  // 低：弱相似（Jaro 0.6~0.8 或 trigram 0.3~0.5）
  if (jaro >= 0.6 || trigram >= 0.3) {
    return {
      candidateId: candidate.id,
      candidateName: candidate.name,
      candidateCity: candidate.city,
      confidence: 'low',
      reasons: [`名称弱相似 ${Math.max(jaro, trigram).toFixed(2)}`],
      customerStatus: candidate.status,
    }
  }
  return null
}

// 中文转拼音（无音调、无分隔），§8.2 主通道名称
export function toPinyin(text: string): string {
  return pinyin(text, { toneType: 'none', type: 'array' }).join('')
}

// 地址归一化（§8.2：去量词），用于地址精确比对
export function normalizeAddress(address: string): string {
  return address
    .trim()
    .toLowerCase()
    .replace(/[省市区县镇街道号栋楼室层单元期座]|室/g, '')
    .replace(/\s+/g, '')
}
