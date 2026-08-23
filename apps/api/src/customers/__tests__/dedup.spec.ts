import { describe, expect, it } from 'vitest'
import { normalizeBusinessName, normalizePhone } from '../customer-normalizer'
import { scoreDuplicate, toPinyin, type DedupCandidate, type DedupInput } from '../dedup'

function candidate(overrides: Partial<DedupCandidate>): DedupCandidate {
  return {
    id: 'c1',
    name: '上海华明机械有限公司',
    normalizedKey: '上海华明机械',
    city: '上海',
    address: null,
    phoneMatched: false,
    trigramSimilarity: 0,
    ...overrides,
  }
}

describe('normalizeBusinessName（§7.3 归一化）', () => {
  it('去空格 + 小写 + 去「有限公司/集团」后缀', () => {
    expect(normalizeBusinessName(' 上海华明 机械 有限公司 ')).toBe('上海华明机械')
    expect(normalizeBusinessName('XX集团')).toBe('xx')
  })

  it('normalizePhone 去符号', () => {
    expect(normalizePhone('138-1234-0001')).toBe('13812340001')
  })
})

describe('toPinyin（§8.2 拼音同音字通道）', () => {
  it('中文转无音调拼音串', () => {
    expect(toPinyin('上海华明机械')).toBe('shanghaihuamingjixie')
    expect(toPinyin('華明機械')).toBe('huamingjixie')
  })
})

describe('scoreDuplicate 置信度分级（§8.2 表格）', () => {
  const base: DedupInput = {
    name: '上海华明机械',
    normalizedKey: '上海华明机械',
    phone: null,
    address: null,
  }

  it('高：电话精确命中（phoneMatched）', () => {
    const r = scoreDuplicate(candidate({ phoneMatched: true }), base)
    expect(r?.confidence).toBe('high')
    expect(r?.reasons).toContain('联系人电话相同')
  })

  it('高：名称归一化后完全相同', () => {
    const r = scoreDuplicate(candidate({ normalizedKey: '上海华明机械' }), base)
    expect(r?.confidence).toBe('high')
  })

  it('高：拼音相同且字数相同（同音字）', () => {
    const r = scoreDuplicate(candidate({ normalizedKey: '上海华名机械' }), base)
    expect(r?.confidence).toBe('high')
  })

  it('高：地址归一化后相同', () => {
    const input = { ...base, address: '上海市浦东新区张江路1号' }
    const r = scoreDuplicate(candidate({ address: '上海 浦东新区 张江路1号' }), input)
    expect(r?.confidence).toBe('high')
    expect(r?.reasons).toContain('地址归一化后相同')
  })

  it('中：trigram ≥ 0.5', () => {
    const r = scoreDuplicate(
      candidate({ normalizedKey: '上海华明机械厂', trigramSimilarity: 0.6 }),
      base,
    )
    expect(r?.confidence).toBe('medium')
  })

  it('中：Jaro-Winkler ≥ 0.8', () => {
    const r = scoreDuplicate(candidate({ normalizedKey: '上海华明机械厂' }), base)
    expect(r?.confidence).toBe('medium')
  })

  it('低：弱相似（trigram 0.3~0.5）', () => {
    const r = scoreDuplicate(
      candidate({ normalizedKey: '上海华铭设备', trigramSimilarity: 0.35 }),
      base,
    )
    expect(r?.confidence).toBe('low')
  })

  it('低于阈值返回 null（不提示）', () => {
    const r = scoreDuplicate(candidate({ trigramSimilarity: 0.1 }), {
      ...base,
      name: '北京某某',
      normalizedKey: '北京某某',
    })
    expect(r).toBeNull()
  })
})
