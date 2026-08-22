import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AccessModule } from '../access/access.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'

@Module({
  imports: [
    // JWT：secret 走环境变量（.env），dev 用默认值（§6.5：access 2h + refresh 14d）
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'litecrm-dev-secret',
      signOptions: { expiresIn: '2h' },
    }),
    AccessModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard],
})
export class AuthModule {}
