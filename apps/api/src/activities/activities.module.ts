import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AccessModule } from '../access/access.module'
import { CatalogModule } from '../catalog/catalog.module'
import { FollowUpActionsModule } from '../follow-up-actions/follow-up-actions.module'
import { VisitsController } from './visits.controller'
import { VisitsService } from './visits.service'

@Module({
  imports: [AuthModule, AccessModule, FollowUpActionsModule, CatalogModule],
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class ActivitiesModule {}
