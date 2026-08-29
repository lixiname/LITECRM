import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AccessModule } from '../access/access.module'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { GradeQuotasController } from './grade-quotas.controller'
import { GradeQuotasService } from './grade-quotas.service'

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [UsersController, GradeQuotasController],
  providers: [UsersService, GradeQuotasService],
  exports: [UsersService],
})
export class OrgModule {}
