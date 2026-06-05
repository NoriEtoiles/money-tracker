import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { validateEnv } from "./config/env.validation";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BudgetsModule } from "./modules/budgets/budgets.module";
import { ExportsModule } from "./modules/exports/exports.module";
import { HealthModule } from "./modules/health/health.module";
import { ImportsModule } from "./modules/imports/imports.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { RecurringModule } from "./modules/recurring/recurring.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { TagsModule } from "./modules/tags/tags.module";
import { TransactionsModule } from "./modules/transactions/transactions.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: [".env", "../../.env"],
      isGlobal: true,
      validate: validateEnv
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AccountsModule,
    BudgetsModule,
    OnboardingModule,
    ReportsModule,
    RecurringModule,
    TagsModule,
    TransactionsModule,
    UsersModule,
    HealthModule,
    ImportsModule,
    ExportsModule,
    SettingsModule
  ]
})
export class AppModule {}
