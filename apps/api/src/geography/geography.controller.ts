import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AdministrativeDivisionDto, SalesRegionDto } from './dto/geography.dto'
import { GeographyService } from './geography.service'

@ApiTags('geography')
@Controller('geography')
@UseGuards(JwtAuthGuard)
export class GeographyController {
  constructor(private readonly geographyService: GeographyService) {}

  @Get('provinces')
  @ApiOkResponse({ type: AdministrativeDivisionDto, isArray: true })
  listProvinces() {
    return this.geographyService.listProvinces()
  }

  @Get('provinces/:provinceCode/cities')
  @ApiOkResponse({ type: AdministrativeDivisionDto, isArray: true })
  listCities(@Param('provinceCode') provinceCode: string) {
    return this.geographyService.listCities(provinceCode)
  }

  @Get('sales-regions')
  @ApiOkResponse({ type: SalesRegionDto, isArray: true })
  listSalesRegions() {
    return this.geographyService.listSalesRegions()
  }
}
