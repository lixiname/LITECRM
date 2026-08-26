import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AccessModule } from '../access/access.module'
import { CustomersModule } from '../customers/customers.module'
import { ClaimsController } from './claims.controller'
import { ClaimsService } from './claims.service'
import { FollowUpActionsModule } from '../follow-up-actions/follow-up-actions.module'

@Module({
  imports: [AuthModule, AccessModule, CustomersModule, FollowUpActionsModule],
  controllers: [ClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
