import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../access/require-permission.decorator'
import { PermissionsGuard } from '../access/permissions.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthUser } from '../auth/auth.service'
import { CustomersService } from './customers.service'
import { CreateCustomerDto } from './dto/create-customer.dto'
import { UpdateCustomerDto } from './dto/update-customer.dto'
import { CustomerQueryDto } from './dto/customer-query.dto'
import { CreateContactDto } from './dto/contact.dto'

// 客户域（§8.2/8.3）：建档（customer.write）/ 检索 / 详情 / 维护
@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiCreatedResponse({ description: '建档成功' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('customer.write')
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customersService.create(dto, user)
  }

  @Get()
  @ApiOkResponse({ description: '客户列表（数据范围过滤 + 五级检索 + 分页）' })
  findAll(@Query() query: CustomerQueryDto, @CurrentUser() user: AuthUser) {
    return this.customersService.findAll(query, user)
  }

  @Get(':id')
  @ApiOkResponse({ description: '客户详情（含联系人）' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.customersService.findOne(id, user)
  }

  @Patch(':id')
  @ApiOkResponse({ description: '更新客户（owner/管理链/admin）' })
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customersService.update(id, dto, user)
  }

  // ===== 联系人（§7.2）=====

  @Post(':id/contacts')
  @ApiCreatedResponse({ description: '新增联系人' })
  addContact(
    @Param('id') id: string,
    @Body() dto: CreateContactDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.addContact(id, dto, user)
  }

  @Patch('contacts/:contactId')
  @ApiOkResponse({ description: '更新联系人' })
  updateContact(
    @Param('contactId') contactId: string,
    @Body() dto: CreateContactDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.updateContact(contactId, dto, user)
  }

  @Delete('contacts/:contactId')
  @ApiOkResponse({ description: '删除联系人' })
  removeContact(@Param('contactId') contactId: string, @CurrentUser() user: AuthUser) {
    return this.customersService.removeContact(contactId, user)
  }
}
