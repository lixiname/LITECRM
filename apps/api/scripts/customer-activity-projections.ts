import { pool } from '../src/common/db/db'
import {
  findCustomerActivityProjectionDrift,
  rebuildCustomerActivityProjections,
} from '../src/customers/customer-activity-projection'

const shouldFix = process.argv.includes('--fix')

async function main() {
  const before = await findCustomerActivityProjectionDrift()
  if (!before.length) {
    console.log('客户活动投影一致，无需修复。')
    return
  }

  console.log(`发现 ${before.length} 个客户的活动投影不一致。`)
  for (const item of before.slice(0, 20)) {
    console.log(
      `${item.customerId}: visit ${item.currentFirstVisitedAt ?? '-'}→${item.expectedFirstVisitedAt ?? '-'}, deal ${item.currentFirstDealAt ?? '-'}→${item.expectedFirstDealAt ?? '-'}, last ${item.currentLastActivityAt ?? '-'}→${item.expectedLastActivityAt ?? '-'}`,
    )
  }
  if (before.length > 20) console.log(`其余 ${before.length - 20} 项未展开。`)

  if (!shouldFix) {
    process.exitCode = 2
    console.log('当前为检查模式；使用 --fix 执行重算。')
    return
  }

  const repaired = await rebuildCustomerActivityProjections()
  const after = await findCustomerActivityProjectionDrift()
  console.log(`已修复 ${repaired} 个客户；剩余差异 ${after.length} 个。`)
  if (after.length) process.exitCode = 1
}

void main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
