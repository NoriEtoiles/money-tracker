import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuditModule } from "../audit/audit.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

@Module({
  controllers: [AuthController],
  exports: [JwtAuthGuard, PasswordService, TokenService],
  imports: [AuditModule, JwtModule.register({})],
  providers: [AuthService, JwtAuthGuard, PasswordService, TokenService]
})
export class AuthModule {}
