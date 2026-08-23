import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { ApiOkResponse } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { RefreshDto } from './dto/refresh.dto'
import { LoginResponseDto } from './dto/login-response.dto'
import { TokenPairDto } from './dto/token-pair.dto'
import { JwtAuthGuard } from './jwt-auth.guard'
import { CurrentUser } from './current-user.decorator'
import type { AuthUser } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 登录（§8.1）：返回 user + access/refresh + 权限快照
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginResponseDto, description: '登录成功' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password)
  }

  // 无感刷新（§6.5）：refresh token 换新双 token（滑动续期）
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokenPairDto, description: '新的令牌对' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken)
  }

  // 本人改密（§8.1）：改密后全端 token 失效
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: '改密成功（全端 token 已失效）' })
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto.oldPassword, dto.newPassword)
  }
}
