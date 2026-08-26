import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../access/require-permission.decorator'
import { PermissionsGuard } from '../access/permissions.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthUser } from '../auth/auth.service'
import { CustomersService } from './customers.service'
import { OwnershipService } from './ownership.service'
import { CreateCustomerDto } from './dto/create-customer.dto'
import { UpdateCustomerDto } from './dto/update-customer.dto'
import { CustomerQueryDto } from './dto/customer-query.dto'
import { CreateContactDto } from './dto/contact.dto'
import { DedupCheckDto } from './dto/dedup-check.dto'
import { TransferCustomerDto } from './dto/transfer-customer.dto'
import { ReleaseCustomerDto } from './dto/release-customer.dto'

// 客户域（§8.2/8.3）：建档（customer.write）/ 检索 / 详情 / 维护
@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly ownershipService: OwnershipService,
  ) {}

  @Post()
  @ApiCreatedResponse({ description: '建档成功' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('customer.write')
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customersService.create(dto, user)
  }

  @Post('dedup-check')
  @ApiOkResponse({ description: '疑似重复列表（置信度分级，§8.2 录入预检）' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('customer.write')
  checkDuplicate(@Body() dto: DedupCheckDto) {
    return this.customersService.checkDuplicate(dto)
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

  // ===== 归属治理（§8.3）=====

  @Post(':id/transfer')
  @ApiOkResponse({ description: '所有权转移（分级名额校验，写移交历史）' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('customer.transfer')
  transfer(
    @Param('id') id: string,
    @Body() dto: TransferCustomerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ownershipService.transfer(id, dto, user)
  }

  @Post(':id/release')
  @ApiOkResponse({ description: '主动释放（pool=公海 / invalid=无效）' })
  release(@Param('id') id: string, @Body() dto: ReleaseCustomerDto, @CurrentUser() user: AuthUser) {
    return this.ownershipService.release(id, dto, user)
  }

  @Post(':id/claim')
  @ApiOkResponse({ description: '公海认领（分级名额校验，owner→本人）' })
  claim(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ownershipService.claim(id, user)
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
