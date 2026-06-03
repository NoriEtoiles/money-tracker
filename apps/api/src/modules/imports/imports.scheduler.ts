import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ImportsService } from "./imports.service";

@Injectable()
export class ImportsScheduler {
  constructor(private readonly importsService: ImportsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredImports(): Promise<void> {
    try {
      await this.importsService.cleanupExpiredImports();
    } catch {
      // A later cleanup tick retries infrastructure failures without logging staged data.
    }
  }
}
