import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AccessModule } from './access/access.module'
import { AuthModule } from './auth/auth.module'
import { OrgModule } from './org/org.module'
import { AuditModule } from './audit/audit.module'
import { CatalogModule } from './catalog/catalog.module'
import { CustomersModule } from './customers/customers.module'
import { ClaimsModule } from './claims/claims.module'
import { ActivitiesModule } from './activities/activities.module'
import { OpportunitiesModule } from './opportunities/opportunities.module'
import { ComplaintsModule } from './complaints/complaints.module'
import { PlanningModule } from './planning/planning.module'
import { ExpensesModule } from './expenses/expenses.module'
import { SalesPlansModule } from './follow-up-actions/follow-up-actions.module'

@Module({
  // ConfigModule 全局加载 .env（§9.3）；业务模块按里程碑接入
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AccessModule,
    AuthModule,
    OrgModule,
    AuditModule,
    CatalogModule,
    CustomersModule,
    ClaimsModule,
    SalesPlansModule,
    ActivitiesModule,
    OpportunitiesModule,
    ComplaintsModule,
    PlanningModule,
    ExpensesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
