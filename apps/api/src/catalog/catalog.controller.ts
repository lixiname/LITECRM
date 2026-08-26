import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../access/require-permission.decorator'
import { PermissionsGuard } from '../access/permissions.guard'
import { CatalogService } from './catalog.service'
import { CreateDimensionOptionDto } from './dto/create-dimension-option.dto'
import { UpdateDimensionOptionDto } from './dto/update-dimension-option.dto'
import { CUSTOMER_DIMENSIONS, type CustomerDimension } from '../common/constants'

// 客户维度配置（§5.1：人员/客户分类配置 web 专属，admin 维护）
// 读：所有登录用户（表单选项与历史值展示需要）；写：admin（user.manage）
@ApiTags('catalog')
@Controller('catalog')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get(':dimension')
  @ApiOkResponse({ description: '某维度全部选项（表单过滤停用项，历史值仍可展示）' })
  listByDimension(
    @Param('dimension', new ParseEnumPipe(CUSTOMER_DIMENSIONS)) dimension: CustomerDimension,
  ) {
    return this.catalogService.listByDimension(dimension)
  }

  @Get()
  @ApiOkResponse({ description: '全部字典项（含停用，admin 维护用）' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('user.manage')
  listAll() {
    return this.catalogService.listAll()
  }

  @Post()
  @ApiCreatedResponse({ description: '新增字典项' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('user.manage')
  create(@Body() dto: CreateDimensionOptionDto) {
    return this.catalogService.create(dto)
  }

  @Patch(':id')
  @ApiOkResponse({ description: '更新字典项' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('user.manage')
  update(@Param('id') id: string, @Body() dto: UpdateDimensionOptionDto) {
    return this.catalogService.update(id, dto)
  }

  @Delete(':id')
  @ApiOkResponse({ description: '停用字典项（软删）' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('user.manage')
  remove(@Param('id') id: string) {
    return this.catalogService.remove(id)
  }
}
