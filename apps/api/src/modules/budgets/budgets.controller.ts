import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  BudgetDeleteResponse,
  BudgetListResponse,
  BudgetResponse,
  BudgetsService
} from "./budgets.service";
import { CreateBudgetDto } from "./dto/create-budget.dto";
import { ListBudgetsDto } from "./dto/list-budgets.dto";
import { UpdateBudgetDto } from "./dto/update-budget.dto";

@Controller("budgets")
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBudgetsDto
  ): Promise<BudgetListResponse> {
    return this.budgetsService.listBudgets(user.userId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBudgetDto
  ): Promise<BudgetResponse> {
    return this.budgetsService.createBudget(user.userId, dto);
  }

  @Patch(":budgetId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("budgetId") budgetId: string,
    @Body() dto: UpdateBudgetDto
  ): Promise<BudgetResponse> {
    return this.budgetsService.updateBudget(user.userId, budgetId, dto);
  }

  @Delete(":budgetId")
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("budgetId") budgetId: string
  ): Promise<BudgetDeleteResponse> {
    return this.budgetsService.archiveBudget(user.userId, budgetId);
  }
}
