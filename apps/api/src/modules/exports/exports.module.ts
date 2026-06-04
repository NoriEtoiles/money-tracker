import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { ExportsController } from "./exports.controller";
import { ExportsService } from "./exports.service";

@Module({
  controllers: [ExportsController],
  imports: [AuditModule, AuthModule],
  providers: [ExportsService]
})
export class ExportsModule {}
