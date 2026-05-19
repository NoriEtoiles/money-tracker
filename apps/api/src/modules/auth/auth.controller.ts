import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedRequest, AuthenticatedUser } from "../../common/auth/authenticated-request";
import { AuthService, LoginResponse, RegisterResponse } from "./auth.service";
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

  private getUserAgent(request: AuthenticatedRequest): string | undefined {
    const userAgent = request.headers?.["user-agent"];

    return Array.isArray(userAgent) ? userAgent[0] : userAgent;
  }
}
