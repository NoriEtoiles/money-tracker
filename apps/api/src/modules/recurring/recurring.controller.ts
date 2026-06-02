import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateRecurringRuleDto } from "./dto/create-recurring-rule.dto";
import { ListRecurringRulesDto } from "./dto/list-recurring-rules.dto";
import { UpdateRecurringRuleDto } from "./dto/update-recurring-rule.dto";
import {
  RecurringRuleDeleteResponse,
  RecurringRuleListResponse,
  RecurringRuleResponse,
  RecurringRulesService
} from "./recurring.service";

@Controller("recurring-rules")
@UseGuards(JwtAuthGuard)
export class RecurringRulesController {
  constructor(private readonly recurringRulesService: RecurringRulesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRecurringRulesDto
  ): Promise<RecurringRuleListResponse> {
    return this.recurringRulesService.listRules(user.userId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecurringRuleDto
  ): Promise<RecurringRuleResponse> {
    return this.recurringRulesService.createRule(user.userId, dto);
  }

  @Patch(":ruleId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ruleId") ruleId: string,
    @Body() dto: UpdateRecurringRuleDto
  ): Promise<RecurringRuleResponse> {
    return this.recurringRulesService.updateRule(user.userId, ruleId, dto);
  }

  @Delete(":ruleId")
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ruleId") ruleId: string
  ): Promise<RecurringRuleDeleteResponse> {
    return this.recurringRulesService.archiveRule(user.userId, ruleId);
  }

  @Post(":ruleId/pause")
  pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ruleId") ruleId: string
  ): Promise<RecurringRuleResponse> {
    return this.recurringRulesService.pauseRule(user.userId, ruleId);
  }

  @Post(":ruleId/resume")
  resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ruleId") ruleId: string
  ): Promise<RecurringRuleResponse> {
    return this.recurringRulesService.resumeRule(user.userId, ruleId);
  }
}
