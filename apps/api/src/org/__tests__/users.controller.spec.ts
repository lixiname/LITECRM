import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { PermissionsGuard } from '../../access/permissions.guard'
import { UsersController } from '../users.controller'
import { UsersService } from '../users.service'

describe('UsersController', () => {
  let app: INestApplication
  const resetPassword = vi.fn().mockResolvedValue('kexxECVcEpFe')
  const unlockLogin = vi.fn().mockResolvedValue({
    id: 'user-1',
    username: 'sales1',
    displayName: '销售一号',
    jobTitle: '业务员',
    role: 'sales',
    phone: null,
    reportsToId: null,
    salesRegionId: null,
    salesRegionName: null,
    isActive: true,
    lockedUntil: null,
    createdAt: '2026-09-14T00:00:00.000Z',
    version: 4,
  })

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: { resetPassword, unlockLogin } }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('以可解析的 JSON 对象返回仅展示一次的临时密码', async () => {
    const response = await request(app.getHttpServer()).post('/users/user-1/reset-password')

    expect(response.status).toBe(201)
    expect(response.headers['content-type']).toMatch(/application\/json/)
    expect(response.body).toEqual({ temporaryPassword: 'kexxECVcEpFe' })
    expect(resetPassword).toHaveBeenCalledWith('user-1')
  })

  it('管理员可解除登录锁定并取得更新后的用户状态', async () => {
    const response = await request(app.getHttpServer())
      .post('/users/user-1/unlock-login')
      .send({ version: 3 })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      id: 'user-1',
      isActive: true,
      lockedUntil: null,
      version: 4,
    })
    expect(unlockLogin).toHaveBeenCalledWith('user-1', 3)
  })
})
