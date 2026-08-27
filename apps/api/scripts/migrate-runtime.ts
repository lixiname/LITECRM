import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from '../src/common/db/db'

async function main() {
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('数据库迁移完成')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
