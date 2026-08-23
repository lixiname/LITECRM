import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AccessModule } from '../access/access.module'
import { VisitsController } from './visits.controller'
import { VisitsService } from './visits.service'

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class ActivitiesModule {}
