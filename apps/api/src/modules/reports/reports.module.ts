import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DashboardService } from "./dashboard.service";
import { ReportsController } from "./reports.controller";

@Module({
  controllers: [ReportsController],
  imports: [AuthModule],
  providers: [DashboardService]
})
export class ReportsModule {}
