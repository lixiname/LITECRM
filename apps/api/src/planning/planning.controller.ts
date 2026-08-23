import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../access/require-permission.decorator'
import { PermissionsGuard } from '../access/permissions.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthUser } from '../auth/auth.service'
import { PlanningService } from './planning.service'
import { CreateBusinessWeekDto } from './dto/create-business-week.dto'
import { CreatePlanItemDto } from './dto/create-plan-item.dto'
import { CreateCommentDto } from './dto/create-comment.dto'

// 周计划与指导意见（§8.7）
@ApiTags('planning')
@Controller()
@UseGuards(JwtAuthGuard)
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  // ===== 业务周（admin 配置）=====

  @Post('business-weeks')
  @ApiCreatedResponse({ description: '创建业务周（admin）' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('user.manage')
  createBusinessWeek(@Body() dto: CreateBusinessWeekDto) {
    return this.planningService.createBusinessWeek(dto)
  }

  @Get('business-weeks')
  @ApiOkResponse({ description: '业务周列表' })
  listBusinessWeeks() {
    return this.planningService.listBusinessWeeks()
  }

  // ===== 周计划 =====

  @Get('plans')
  @ApiOkResponse({ description: '我的周计划（含计划项）' })
  getMyPlan(@Query('businessWeekId') businessWeekId: string, @CurrentUser() user: AuthUser) {
    return this.planningService.getMyPlan(businessWeekId, user)
  }

  @Post('plans/:id/items')
  @ApiCreatedResponse({ description: '加计划项' })
  addPlanItem(
    @Param('id') id: string,
    @Body() dto: CreatePlanItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.planningService.addPlanItem(id, dto, user)
  }

  // ===== 指导意见 =====

  @Post('comments')
  @ApiCreatedResponse({ description: '发布指导意见（上级对下属）' })
  createComment(@Body() dto: CreateCommentDto, @CurrentUser() user: AuthUser) {
    return this.planningService.createComment(dto, user)
  }

  @Get('comments/unread')
  @ApiOkResponse({ description: '我的未读意见' })
  listUnread(@CurrentUser() user: AuthUser) {
    return this.planningService.listUnreadComments(user)
  }

  @Post('comments/:id/read')
  @ApiOkResponse({ description: '标记已读' })
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.planningService.markCommentRead(id, user)
  }
}
