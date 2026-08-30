import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthUser } from '../auth/auth.service'
import { PermissionsGuard } from '../access/permissions.guard'
import { RequirePermission } from '../access/require-permission.decorator'
import { ExpensesService } from './expenses.service'
import { CreateExpenseDto } from './dto/create-expense.dto'
import { ExpenseCommandDto } from './dto/expense-command.dto'

// 每日费用（§8.8：轻量统计；customer.write 填报）
@ApiTags('expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('customer.write')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiCreatedResponse({ description: '保存/更新当日费用（upsert）' })
  upsert(@Body() dto: CreateExpenseDto, @CurrentUser() user: AuthUser) {
    return this.expensesService.upsert(dto, user)
  }

  @Get()
  @ApiOkResponse({ description: '我的费用（可按月 YYYY-MM 筛选）' })
  list(@Query('month') month: string | undefined, @CurrentUser() user: AuthUser) {
    return this.expensesService.list(user, month)
  }

  @Post(':id/submit')
  @ApiOkResponse({ description: '提交（计入统计）' })
  submit(@Param('id') id: string, @Body() dto: ExpenseCommandDto, @CurrentUser() user: AuthUser) {
    return this.expensesService.submit(id, dto.version, user)
  }

  @Post(':id/void')
  @ApiOkResponse({ description: '作废（剔除统计，留痕）' })
  void(@Param('id') id: string, @Body() dto: ExpenseCommandDto, @CurrentUser() user: AuthUser) {
    return this.expensesService.void(id, dto.version, user)
  }
}
