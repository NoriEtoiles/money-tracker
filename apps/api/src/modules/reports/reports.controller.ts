import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DashboardResponse, DashboardService } from "./dashboard.service";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { NetWorthQueryDto } from "./dto/net-worth-query.dto";
import { ReportDateRangeQueryDto } from "./dto/report-date-range-query.dto";
import {
  CashflowReportResponse,
  NetWorthReportResponse,
  ReportsService,
  SpendingReportResponse
} from "./reports.service";

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly reportsService: ReportsService
  ) {}

  @Get("dashboard")
  dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardQueryDto
  ): Promise<DashboardResponse> {
    return this.dashboardService.getDashboard(user.userId, query);
  }

  @Get("spending")
  spending(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportDateRangeQueryDto
  ): Promise<SpendingReportResponse> {
    return this.reportsService.getSpendingReport(user.userId, query);
  }

  @Get("cashflow")
  cashflow(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportDateRangeQueryDto
  ): Promise<CashflowReportResponse> {
    return this.reportsService.getCashflowReport(user.userId, query);
  }

  @Get("net-worth")
  netWorth(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NetWorthQueryDto
  ): Promise<NetWorthReportResponse> {
    return this.reportsService.getNetWorthReport(user.userId, query);
  }
}
