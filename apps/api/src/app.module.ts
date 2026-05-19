import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env.validation";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
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
    PrismaModule,
    AuthModule,
    AccountsModule,
    OnboardingModule,
    TagsModule,
    TransactionsModule,
    UsersModule,
    HealthModule
  ]
})
export class AppModule {}
