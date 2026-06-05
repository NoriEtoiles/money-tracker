import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
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

export type SessionResponse = {
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
  sessionId: string;
  userAgent: string | null;
};

export type SessionListResponse = {
  items: SessionResponse[];
};

export type RevokeSessionsResponse = {
  revokedCount: number;
  success: true;
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

  async changePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordDto
  ): Promise<RevokeSessionsResponse> {
    const account = await this.prisma.user.findFirst({
      select: {
        id: true,
        passwordHash: true
      },
      where: {
        deletedAt: null,
        id: user.userId,
        status: "active"
      }
    });
    const currentPasswordMatches = account?.passwordHash
      ? await this.passwordService.verifyPassword(dto.currentPassword, account.passwordHash)
      : false;

    if (account === null || !currentPasswordMatches) {
      throw new UnauthorizedException("Current password is invalid");
    }

    const newPasswordHash = await this.passwordService.hashPassword(dto.newPassword);
    const revoked = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        data: {
          passwordHash: newPasswordHash
        },
        where: {
          id: user.userId
        }
      });

      return tx.session.updateMany({
        data: {
          revokedAt: new Date()
        },
        where: {
          id: {
            not: user.sessionId
          },
          revokedAt: null,
          userId: user.userId
        }
      });
    });

    await this.auditService.record({
      entityId: user.userId,
      entityType: "user",
      eventType: "password_change",
      metadata: {
        revokedSessionCount: revoked.count
      },
      userId: user.userId
    });

    return {
      revokedCount: revoked.count,
      success: true
    };
  }

  async listSessions(user: AuthenticatedUser, now = new Date()): Promise<SessionListResponse> {
    const sessions = await this.prisma.session.findMany({
      orderBy: [
        {
          createdAt: "desc"
        },
        {
          id: "desc"
        }
      ],
      select: {
        createdAt: true,
        expiresAt: true,
        id: true,
        userAgent: true
      },
      where: {
        expiresAt: {
          gt: now
        },
        revokedAt: null,
        userId: user.userId
      }
    });

    return {
      items: sessions.map((session) => ({
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        isCurrent: session.id === user.sessionId,
        sessionId: session.id,
        userAgent: this.safeUserAgent(session.userAgent)
      }))
    };
  }

  async revokeSession(
    user: AuthenticatedUser,
    sessionId: string
  ): Promise<RevokeSessionsResponse> {
    if (sessionId === user.sessionId) {
      throw new BadRequestException("Use logout to revoke the current session");
    }

    const result = await this.prisma.session.updateMany({
      data: {
        revokedAt: new Date()
      },
      where: {
        id: sessionId,
        revokedAt: null,
        userId: user.userId
      }
    });

    if (result.count === 0) {
      throw new NotFoundException("Session not found");
    }

    await this.auditService.record({
      entityType: "session",
      eventType: "session_revoke",
      metadata: {
        revokedCount: result.count
      },
      userId: user.userId
    });

    return {
      revokedCount: result.count,
      success: true
    };
  }

  async revokeOtherSessions(user: AuthenticatedUser): Promise<RevokeSessionsResponse> {
    const result = await this.prisma.session.updateMany({
      data: {
        revokedAt: new Date()
      },
      where: {
        id: {
          not: user.sessionId
        },
        revokedAt: null,
        userId: user.userId
      }
    });

    await this.auditService.record({
      entityType: "session",
      eventType: "session_revoke_others",
      metadata: {
        revokedCount: result.count
      },
      userId: user.userId
    });

    return {
      revokedCount: result.count,
      success: true
    };
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

  private safeUserAgent(userAgent: string | null): string | null {
    if (userAgent === null) {
      return null;
    }

    const normalized = userAgent.replace(/[\r\n\t]/g, " ").trim();

    return normalized.length <= 160 ? normalized : `${normalized.slice(0, 157)}...`;
  }
}
