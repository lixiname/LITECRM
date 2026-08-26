import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../access/require-permission.decorator'
import { PermissionsGuard } from '../access/permissions.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthUser } from '../auth/auth.service'
import { ClaimsService } from './claims.service'
import { CreateClaimDto } from './dto/create-claim.dto'
import { ReviewClaimDto } from './dto/review-claim.dto'
import { ClaimRequestDto } from './dto/claim-request.dto'

// 接管审批流（§8.3）：发起（customer.transfer）/ 审批·拒绝（approve.claim）/ 撤回
@ApiTags('claims')
@Controller('claims')
@UseGuards(JwtAuthGuard)
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Post('customer/:customerId')
  @ApiCreatedResponse({ description: '发起接管申请' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('customer.transfer')
  create(
    @Param('customerId') customerId: string,
    @Body() dto: CreateClaimDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.claimsService.create(customerId, dto, user)
  }

  @Get()
  @ApiOkResponse({
    type: ClaimRequestDto,
    isArray: true,
    description: '待审批申请列表（executive/admin）',
  })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('approve.claim')
  listPending(@CurrentUser() user: AuthUser) {
    return this.claimsService.listPending(user)
  }

  @Post(':id/approve')
  @ApiOkResponse({ description: '审批通过（归属变更 + 分级名额校验）' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('approve.claim')
  approve(@Param('id') id: string, @Body() dto: ReviewClaimDto, @CurrentUser() user: AuthUser) {
    return this.claimsService.approve(id, dto, user)
  }

  @Post(':id/reject')
  @ApiOkResponse({ description: '拒绝（意见必填）' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('approve.claim')
  reject(@Param('id') id: string, @Body() dto: ReviewClaimDto, @CurrentUser() user: AuthUser) {
    return this.claimsService.reject(id, dto, user)
  }

  @Post(':id/withdraw')
  @ApiOkResponse({ description: '撤回（仅申请人本人）' })
  withdraw(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.claimsService.withdraw(id, user)
  }
}
