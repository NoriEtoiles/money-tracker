import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { RecurringRulesService } from "./recurring.service";

@Injectable()
export class RecurringScheduler {
  constructor(private readonly recurringRulesService: RecurringRulesService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async generateDueTransactions(): Promise<void> {
    try {
      await this.recurringRulesService.generateDueTransactions();
    } catch {
      // A later tick retries unexpected infrastructure failures without logging financial payloads.
    }
  }
}
