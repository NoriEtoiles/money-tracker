import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { CategoriesModule } from "../categories/categories.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  controllers: [OnboardingController],
  imports: [AuditModule, AuthModule, CategoriesModule],
  providers: [OnboardingService]
})
export class OnboardingModule {}
