import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { BudgetsController } from "./budgets.controller";
import { BudgetsService } from "./budgets.service";

@Module({
  controllers: [BudgetsController],
  imports: [AuditModule, AuthModule],
  providers: [BudgetsService]
})
export class BudgetsModule {}
