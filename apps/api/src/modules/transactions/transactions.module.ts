import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";
import { TransfersController } from "./transfers.controller";
import { TransfersService } from "./transfers.service";

@Module({
  controllers: [TransactionsController, TransfersController],
  imports: [AuditModule, AuthModule],
  providers: [TransactionsService, TransfersService]
})
export class TransactionsModule {}
