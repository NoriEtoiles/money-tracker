import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";

@Module({
  controllers: [AccountsController],
  imports: [AuditModule, AuthModule],
  providers: [AccountsService]
})
export class AccountsModule {}
