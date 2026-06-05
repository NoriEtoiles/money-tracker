import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedRequest, AuthenticatedUser } from "../../common/auth/authenticated-request";
import {
  AuthService,
  LoginResponse,
  RegisterResponse,
  RevokeSessionsResponse,
  SessionListResponse
} from "./auth.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto, @Req() request: AuthenticatedRequest): Promise<RegisterResponse> {
    return this.authService.register(dto, {
      ipAddress: request.ip,
      userAgent: this.getUserAgent(request)
    });
  }

  @Post("login")
  login(@Body() dto: LoginDto, @Req() request: AuthenticatedRequest): Promise<LoginResponse> {
    return this.authService.login(dto, {
      ipAddress: request.ip,
      userAgent: this.getUserAgent(request)
    });
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: AuthenticatedUser): Promise<{ success: true }> {
    return this.authService.logout(user);
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto
  ): Promise<RevokeSessionsResponse> {
    return this.authService.changePassword(user, dto);
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  listSessions(@CurrentUser() user: AuthenticatedUser): Promise<SessionListResponse> {
    return this.authService.listSessions(user);
  }

  @Post("sessions/revoke-others")
  @UseGuards(JwtAuthGuard)
  revokeOtherSessions(@CurrentUser() user: AuthenticatedUser): Promise<RevokeSessionsResponse> {
    return this.authService.revokeOtherSessions(user);
  }

  @Post("sessions/:sessionId/revoke")
  @UseGuards(JwtAuthGuard)
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param("sessionId", new ParseUUIDPipe({ version: "4" })) sessionId: string
  ): Promise<RevokeSessionsResponse> {
    return this.authService.revokeSession(user, sessionId);
  }

  private getUserAgent(request: AuthenticatedRequest): string | undefined {
    const userAgent = request.headers?.["user-agent"];

    return Array.isArray(userAgent) ? userAgent[0] : userAgent;
  }
}
