import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../access/require-permission.decorator'
import { PermissionsGuard } from '../access/permissions.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthUser } from '../auth/auth.service'
import { ComplaintsService } from './complaints.service'
import { CreateComplaintDto } from './dto/create-complaint.dto'
import { FollowUpComplaintDto } from './dto/follow-up-complaint.dto'

// 客诉闭环（§8.6）：登记/跟进/确认解决（customer.write）
@ApiTags('complaints')
@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  @ApiCreatedResponse({ description: '登记客诉' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('customer.write')
  create(@Body() dto: CreateComplaintDto, @CurrentUser() user: AuthUser) {
    return this.complaintsService.create(dto, user)
  }

  @Get()
  @ApiOkResponse({ description: '客诉列表（客户当前归属可见）' })
  list(@Query('customerId') customerId: string | undefined, @CurrentUser() user: AuthUser) {
    return this.complaintsService.list(user, customerId)
  }

  @Get(':id')
  @ApiOkResponse({ description: '客诉详情（含跟进事件）' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.complaintsService.findOne(id, user)
  }

  @Post(':id/follow-up')
  @ApiOkResponse({ description: '跟进 / 确认解决（终态禁止）' })
  followUp(
    @Param('id') id: string,
    @Body() dto: FollowUpComplaintDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.complaintsService.followUp(id, dto, user)
  }
}
