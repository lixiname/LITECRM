import { Module } from '@nestjs/common'
import { AccessModule } from '../access/access.module'
import { AuthModule } from '../auth/auth.module'
import { ReportingController } from './reporting.controller'
import { ReportingService } from './reporting.service'

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [ReportingController],
  providers: [ReportingService],
})
export class ReportingModule {}
