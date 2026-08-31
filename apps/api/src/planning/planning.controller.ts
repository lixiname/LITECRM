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
import { CreatePlanCommentDto } from './dto/create-comment.dto'

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

  @Post('plans/items-by-date')
  @ApiCreatedResponse({ description: '按日期加计划项（周览点空白加计划，自动定位业务周）' })
  addPlanItemByDate(@Body() dto: CreatePlanItemDto, @CurrentUser() user: AuthUser) {
    return this.planningService.addPlanItemByDate(dto, user)
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

  // ===== 计划指导留言 =====

  @Get('sales-plans/:id/comments')
  @ApiOkResponse({ description: '读取一条可见计划的全部指导留言' })
  listPlanComments(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.planningService.listPlanComments(id, user)
  }

  @Post('sales-plans/:id/comments')
  @ApiCreatedResponse({ description: '递归上级给下属的待执行计划发布指导留言' })
  createPlanComment(
    @Param('id') id: string,
    @Body() dto: CreatePlanCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.planningService.createPlanComment(id, dto, user)
  }

  @Post('sales-plans/:id/comments/read')
  @ApiOkResponse({ description: '计划负责人将该计划全部指导留言标记为已读' })
  markPlanCommentsRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.planningService.markPlanCommentsRead(id, user)
  }
}
