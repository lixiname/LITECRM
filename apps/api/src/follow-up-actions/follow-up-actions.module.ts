import { Module } from '@nestjs/common'
import { AccessModule } from '../access/access.module'
import { AuthModule } from '../auth/auth.module'
import { FollowUpActionsController } from './follow-up-actions.controller'
import { FollowUpActionsService } from './follow-up-actions.service'

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [FollowUpActionsController],
  providers: [FollowUpActionsService],
  exports: [FollowUpActionsService],
})
export class FollowUpActionsModule {}
