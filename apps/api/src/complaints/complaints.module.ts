import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AccessModule } from '../access/access.module'
import { CatalogModule } from '../catalog/catalog.module'
import { ComplaintsController } from './complaints.controller'
import { ComplaintsService } from './complaints.service'
import { SalesPlansModule } from '../follow-up-actions/follow-up-actions.module'

@Module({
  imports: [AuthModule, AccessModule, CatalogModule, SalesPlansModule],
  controllers: [ComplaintsController],
  providers: [ComplaintsService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
