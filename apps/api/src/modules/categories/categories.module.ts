import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";

@Module({
  controllers: [CategoriesController],
  exports: [CategoriesService],
  imports: [AuditModule, AuthModule],
  providers: [CategoriesService]
})
export class CategoriesModule {}
