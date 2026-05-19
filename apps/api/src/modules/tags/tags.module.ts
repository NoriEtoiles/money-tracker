import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { TagsController } from "./tags.controller";
import { TagsService } from "./tags.service";

@Module({
  controllers: [TagsController],
  imports: [AuditModule, AuthModule],
  providers: [TagsService]
})
export class TagsModule {}
