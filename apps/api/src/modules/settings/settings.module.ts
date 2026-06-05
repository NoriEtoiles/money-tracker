import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { AuditEventsController } from "./audit-events.controller";
import { DeletionRequestsController } from "./deletion-requests.controller";
import { SettingsService } from "./settings.service";

@Module({
  controllers: [AuditEventsController, DeletionRequestsController],
  imports: [AuditModule, AuthModule],
  providers: [SettingsService]
})
export class SettingsModule {}
