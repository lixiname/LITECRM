import { Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { db } from './common/db/db'

@Injectable()
export class AppService {
  getHello(): string {
    return 'Lite CRM API'
  }

  async getHealth(): Promise<{ status: 'ok'; database: 'ok'; timestamp: string }> {
    await db.execute(sql`select 1`)
    return { status: 'ok', database: 'ok', timestamp: new Date().toISOString() }
  }
}
