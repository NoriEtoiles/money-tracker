import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ImportsController } from "./imports.controller";
import { ImportsScheduler } from "./imports.scheduler";
import { ImportsService } from "./imports.service";

@Module({
  controllers: [ImportsController],
  imports: [AuthModule],
  providers: [ImportsService, ImportsScheduler]
})
export class ImportsModule {}
