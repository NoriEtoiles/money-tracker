import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { RecurringRulesController } from "./recurring.controller";
import { RecurringScheduler } from "./recurring.scheduler";
import { RecurringRulesService } from "./recurring.service";

@Module({
  controllers: [RecurringRulesController],
  imports: [AuditModule, AuthModule],
  providers: [RecurringRulesService, RecurringScheduler]
})
export class RecurringModule {}
