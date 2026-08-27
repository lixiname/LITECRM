import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AccessModule } from '../access/access.module'
import { CustomersController } from './customers.controller'
import { CustomersService } from './customers.service'
import { OwnershipService } from './ownership.service'
import { GradeQuotaService } from './grade-quota.service'
import { CustomerAssigneeService } from './customer-assignee.service'
import { SalesPlansModule } from '../follow-up-actions/follow-up-actions.module'

@Module({
  imports: [AuthModule, AccessModule, SalesPlansModule],
  controllers: [CustomersController],
  providers: [CustomersService, OwnershipService, GradeQuotaService, CustomerAssigneeService],
  exports: [CustomersService, OwnershipService, GradeQuotaService, CustomerAssigneeService],
})
export class CustomersModule {}
