import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AccessModule } from '../access/access.module'
import { CatalogModule } from '../catalog/catalog.module'
import { SalesPlansModule } from '../follow-up-actions/follow-up-actions.module'
import { VisitsController } from './visits.controller'
import { VisitsService } from './visits.service'
import { VisitEntryRulesService } from './visit-entry-rules.service'

@Module({
  imports: [AuthModule, AccessModule, SalesPlansModule, CatalogModule],
  controllers: [VisitsController],
  providers: [VisitsService, VisitEntryRulesService],
  exports: [VisitsService],
})
export class ActivitiesModule {}
