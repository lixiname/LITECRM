import { Module } from '@nestjs/common'
import { AccessModule } from '../access/access.module'
import { AuthModule } from '../auth/auth.module'
import { AlertsController } from './alerts.controller'
import { AlertsService } from './alerts.service'

@Module({
  imports: [AccessModule, AuthModule],
  controllers: [AlertsController],
  providers: [AlertsService],
})
export class AlertsModule {}
