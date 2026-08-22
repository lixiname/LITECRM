import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AccessModule } from './access/access.module'
import { AuthModule } from './auth/auth.module'
import { OrgModule } from './org/org.module'
import { AuditModule } from './audit/audit.module'

@Module({
  // ConfigModule 全局加载 .env（§9.3）；业务模块按里程碑接入
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AccessModule,
    AuthModule,
    OrgModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
