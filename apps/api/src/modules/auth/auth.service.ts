import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

export type RegisterResponse = {
  status: "created";
  userId: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    displayName: string;
    email: string;
    id: string;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService
  ) {}

  async register(dto: RegisterDto, context: RequestContext): Promise<RegisterResponse> {
    const email = this.normalizeEmail(dto.email);
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser !== null) {
      throw new ConflictException("Email is already registered");
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        displayName: dto.displayName.trim(),
        email,
        passwordHash
      }
    });

    await this.auditService.record({
      entityId: user.id,
      entityType: "user",
      eventType: "register",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      userId: user.id
    });

    return {
      status: "created",
      userId: user.id
    };
  }

  async login(dto: LoginDto, context: RequestContext): Promise<LoginResponse> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordMatches = user?.passwordHash
      ? await this.passwordService.verifyPassword(dto.password, user.passwordHash)
      : false;

    if (user === null || user.deletedAt !== null || user.status !== "active" || !passwordMatches) {
      await this.auditService.record({
        eventType: "failed_login",
        ipAddress: context.ipAddress,
        metadata: { email },
        userAgent: context.userAgent,
        userId: user?.id
      });

      throw new UnauthorizedException("Invalid email or password");
    }

    const refreshToken = this.createRefreshToken();
    const refreshTokenHash = await this.passwordService.hashToken(refreshToken);
    const session = await this.prisma.session.create({
      data: {
        expiresAt: this.getRefreshTokenExpiry(),
        ipAddress: context.ipAddress,
        refreshTokenHash,
        userAgent: context.userAgent,
        userId: user.id
      }
    });

    await this.auditService.record({
      eventType: "login",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      userId: user.id
    });

    return {
      accessToken: await this.tokenService.signAccessToken({
        email: user.email,
        sessionId: session.id,
        userId: user.id
      }),
      refreshToken,
      user: {
        displayName: user.displayName,
        email: user.email,
        id: user.id
      }
    };
  }

  async logout(user: AuthenticatedUser): Promise<{ success: true }> {
    await this.prisma.session.updateMany({
      data: {
        revokedAt: new Date()
      },
      where: {
        id: user.sessionId,
        revokedAt: null,
        userId: user.userId
      }
    });

    await this.auditService.record({
      eventType: "logout",
      userId: user.userId
    });

    return { success: true };
  }

  private createRefreshToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private getRefreshTokenExpiry(): Date {
    const ttlDays = this.configService.getOrThrow<number>("REFRESH_TOKEN_TTL_DAYS");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    return expiresAt;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
