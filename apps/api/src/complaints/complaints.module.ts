import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AccessModule } from '../access/access.module'
import { ComplaintsController } from './complaints.controller'
import { ComplaintsService } from './complaints.service'

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [ComplaintsController],
  providers: [ComplaintsService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
