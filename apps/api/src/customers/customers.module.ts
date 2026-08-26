import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AccessModule } from '../access/access.module'
import { CustomersController } from './customers.controller'
import { CustomersService } from './customers.service'
import { OwnershipService } from './ownership.service'
import { GradeQuotaService } from './grade-quota.service'

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [CustomersController],
  providers: [CustomersService, OwnershipService, GradeQuotaService],
  exports: [CustomersService, OwnershipService, GradeQuotaService],
})
export class CustomersModule {}
