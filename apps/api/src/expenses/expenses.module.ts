import { Module } from '@nestjs/common'
import { AccessModule } from '../access/access.module'
import { AuthModule } from '../auth/auth.module'
import { ExpensesController } from './expenses.controller'
import { ExpensesService } from './expenses.service'

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
