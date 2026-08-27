import { Module } from '@nestjs/common'
import { AccessModule } from '../access/access.module'
import { AuthModule } from '../auth/auth.module'
import { SalesPlansController } from './follow-up-actions.controller'
import { SalesPlansService } from './follow-up-actions.service'

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [SalesPlansController],
  providers: [SalesPlansService],
  exports: [SalesPlansService],
})
export class SalesPlansModule {}
