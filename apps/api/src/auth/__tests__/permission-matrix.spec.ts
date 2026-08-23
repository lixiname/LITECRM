import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { eq } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../../app.module'
import { AccessService } from '../../access/access.service'
import { seedAccounts } from '../../../scripts/seed'
import { db } from '../../common/db/db'
import { users } from '../../common/db/schema'

// 权限矩阵（M1 多角色端到端）：真实 DB + 完整 Nest 应用（含全局 prefix/校验管道）
// 依赖：本地 docker db 或 CI postgres service；beforeAll 幂等 seed
describe('权限矩阵（§6.1/6.2：4 角色 × 能力点 × 数据范围）', () => {
  let app: INestApplication
  let accessService: AccessService

  beforeAll(async () => {
    await seedAccounts()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
    accessService = app.get(AccessService)
  })

  afterAll(async () => {
    await app?.close()
  })

  async function login(username: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
    expect(res.status).toBe(200)
    return res.body as {
      accessToken: string
      user: { role: string }
      capabilities: string[]
      dataScope: string
    }
  }

  async function getUserId(username: string): Promise<string> {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.username, username))
    if (!row) throw new Error(`seed 账号缺失：${username}`)
    return row.id
  }

  describe('各角色登录权限快照（§8.1）', () => {
    it('admin：full 范围 + 全部能力点', async () => {
      const res = await login('admin', 'Admin@123456')
      expect(res.user.role).toBe('admin')
      expect(res.dataScope).toBe('full')
      expect(res.capabilities).toContain('user.manage')
      expect(res.capabilities).toContain('customer.write')
    })

    it('executive：team 范围 + 经营看板，无系统配置', async () => {
      const res = await login('manager', 'Crm@123456')
      expect(res.user.role).toBe('executive')
      expect(res.dataScope).toBe('team')
      expect(res.capabilities).toContain('dashboard.view')
      expect(res.capabilities).toContain('customer.write')
      expect(res.capabilities).not.toContain('user.manage')
    })

    it('sales：self 范围 + 基础填报，无经营看板', async () => {
      const res = await login('sales1', 'Crm@123456')
      expect(res.user.role).toBe('sales')
      expect(res.dataScope).toBe('self')
      expect(res.capabilities).toContain('customer.write')
      expect(res.capabilities).toContain('customer.transfer')
      expect(res.capabilities).not.toContain('dashboard.view')
      expect(res.capabilities).not.toContain('stats.view')
    })

    it('assistant：full 范围 + 只读统计，无填报权', async () => {
      const res = await login('assistant', 'Crm@123456')
      expect(res.user.role).toBe('assistant')
      expect(res.dataScope).toBe('full')
      expect(res.capabilities).toContain('stats.view')
      expect(res.capabilities).toContain('export')
      expect(res.capabilities).not.toContain('customer.write')
    })
  })

  describe('越权拦截（PEP：PermissionsGuard）', () => {
    it('无 token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/users')
      expect(res.status).toBe(401)
    })

    it('sales 访问 /users（user.manage 仅 admin）→ 403', async () => {
      const sales = await login('sales1', 'Crm@123456')
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${sales.accessToken}`)
      expect(res.status).toBe(403)
    })

    it('executive 访问 /users → 403', async () => {
      const manager = await login('manager', 'Crm@123456')
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${manager.accessToken}`)
      expect(res.status).toBe(403)
    })

    it('admin 访问 /users → 200', async () => {
      const admin = await login('admin', 'Admin@123456')
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${admin.accessToken}`)
      expect(res.status).toBe(200)
    })
  })

  describe('组织树数据范围（§6.1：self/team/full）', () => {
    it('executive（manager）：team = 本人 + 直属/间接下属', async () => {
      const managerId = await getUserId('manager')
      const sales1Id = await getUserId('sales1')
      const sales2Id = await getUserId('sales2')
      const adminId = await getUserId('admin')

      const visible = await accessService.getVisibleUserIds({
        id: managerId,
        role: 'executive',
        reportsToId: adminId,
      })
      expect([...visible].sort()).toEqual([managerId, sales1Id, sales2Id].sort())
      expect(visible).not.toContain(adminId) // 上级不在 team 范围
    })

    it('sales：self = 仅本人', async () => {
      const sales1Id = await getUserId('sales1')
      const visible = await accessService.getVisibleUserIds({
        id: sales1Id,
        role: 'sales',
        reportsToId: null,
      })
      expect(visible).toEqual([sales1Id])
    })

    it('admin / assistant：full = 全部用户', async () => {
      const all = await db.select({ id: users.id }).from(users)
      const adminId = await getUserId('admin')
      const assistantId = await getUserId('assistant')

      const adminVisible = await accessService.getVisibleUserIds({
        id: adminId,
        role: 'admin',
        reportsToId: null,
      })
      expect(adminVisible.length).toBe(all.length)

      const assistantVisible = await accessService.getVisibleUserIds({
        id: assistantId,
        role: 'assistant',
        reportsToId: null,
      })
      expect(assistantVisible.length).toBe(all.length)
    })
  })
})
