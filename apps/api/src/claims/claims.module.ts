import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AccessModule } from '../access/access.module'
import { CustomersModule } from '../customers/customers.module'
import { ClaimsController } from './claims.controller'
import { ClaimsService } from './claims.service'

@Module({
  imports: [AuthModule, AccessModule, CustomersModule],
  controllers: [ClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
