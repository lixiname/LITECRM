import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AccessModule } from '../access/access.module'
import { PlanningController } from './planning.controller'
import { PlanningService } from './planning.service'
import { WeekViewController } from './week-view.controller'
import { WeekViewService } from './week-view.service'
import { SalesPlansModule } from '../follow-up-actions/follow-up-actions.module'

@Module({
  imports: [AuthModule, AccessModule, SalesPlansModule],
  controllers: [PlanningController, WeekViewController],
  providers: [PlanningService, WeekViewService],
  exports: [PlanningService],
})
export class PlanningModule {}
