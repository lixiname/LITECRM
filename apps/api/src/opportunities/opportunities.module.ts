import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AccessModule } from '../access/access.module'
import { CatalogModule } from '../catalog/catalog.module'
import { OpportunitiesController } from './opportunities.controller'
import { OpportunitiesService } from './opportunities.service'
import { OpportunityAccessService } from './opportunity-access.service'
import { OpportunityCommandsService } from './opportunity-commands.service'
import { SalesPlansModule } from '../follow-up-actions/follow-up-actions.module'

@Module({
  imports: [AuthModule, AccessModule, CatalogModule, SalesPlansModule],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService, OpportunityAccessService, OpportunityCommandsService],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
