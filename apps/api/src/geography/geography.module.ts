import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { GeographyController } from './geography.controller'
import { GeographyService } from './geography.service'

@Module({
  imports: [AuthModule],
  controllers: [GeographyController],
  providers: [GeographyService],
  exports: [GeographyService],
})
export class GeographyModule {}
