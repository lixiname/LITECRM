import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AccessModule } from '../access/access.module'
import { OpportunitiesController } from './opportunities.controller'
import { OpportunitiesService } from './opportunities.service'

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
