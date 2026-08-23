import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../access/require-permission.decorator'
import { PermissionsGuard } from '../access/permissions.guard'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UserDto } from './dto/user.dto'

// 用户管理：admin（user.manage）专属（§6.2）
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('user.manage')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOkResponse({ type: UserDto, isArray: true, description: '用户列表' })
  findAll() {
    return this.usersService.findAll()
  }

  @Get(':id')
  @ApiOkResponse({ type: UserDto, description: '用户详情' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id)
  }

  @Post()
  @ApiCreatedResponse({ type: UserDto, description: '创建成功' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto)
  }

  @Patch(':id')
  @ApiOkResponse({ type: UserDto, description: '更新成功' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto)
  }

  @Delete(':id')
  @ApiOkResponse({ description: '停用成功' })
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id)
  }

  // 重置密码：返回临时密码（仅此一次展示，§8.1）
  @Post(':id/reset-password')
  @ApiCreatedResponse({ type: String, description: '临时密码（仅此一次展示）' })
  resetPassword(@Param('id') id: string) {
    return this.usersService.resetPassword(id)
  }
}
