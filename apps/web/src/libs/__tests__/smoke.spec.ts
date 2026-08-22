import { describe, expect, it } from 'vitest'

// M0 骨架 smoke 测试：撑起 test 流水线；业务测试随模块推进
describe('smoke', () => {
  it('runs the test pipeline', () => {
    expect(1 + 1).toBe(2)
  })
})
