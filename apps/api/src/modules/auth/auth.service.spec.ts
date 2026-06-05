import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { AuthService } from "./auth.service";

type FakeUser = {
  deletedAt: Date | null;
  id: string;
  passwordHash: string | null;
  status: string;
};

type FakeSession = {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  refreshTokenHash: string;
  revokedAt: Date | null;
  userAgent: string | null;
  userId: string;
};

type FakeAuditEvent = {
  entityType?: string;
  eventType: string;
  metadata?: unknown;
  userId?: string;
};

class FakePrismaService {
  readonly sessions = new Map<string, FakeSession>();
  readonly users = new Map<string, FakeUser>();

  readonly user = {
    findFirst: async (input: {
      where: { deletedAt: Date | null; id: string; status: string };
    }): Promise<Pick<FakeUser, "id" | "passwordHash"> | null> => {
      const user = this.users.get(input.where.id);

      return user !== undefined &&
        user.deletedAt === input.where.deletedAt &&
        user.status === input.where.status
        ? {
            id: user.id,
            passwordHash: user.passwordHash
          }
        : null;
    },
    update: async (input: {
      data: { passwordHash: string };
      where: { id: string };
    }): Promise<FakeUser> => {
      const user = this.users.get(input.where.id);

      if (user === undefined) {
        throw new Error("Missing fake user");
      }

      user.passwordHash = input.data.passwordHash;

      return user;
    }
  };

  readonly session = {
    findMany: async (input: {
      where: {
        expiresAt: { gt: Date };
        revokedAt: Date | null;
        userId: string;
      };
    }): Promise<FakeSession[]> =>
      [...this.sessions.values()]
        .filter((session) =>
          session.userId === input.where.userId &&
          session.revokedAt === input.where.revokedAt &&
          session.expiresAt.getTime() > input.where.expiresAt.gt.getTime()
        )
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
    updateMany: async (input: {
      data: { revokedAt: Date };
      where: {
        id?: string | { not: string };
        revokedAt: Date | null;
        userId: string;
      };
    }): Promise<{ count: number }> => {
      let count = 0;

      this.sessions.forEach((session) => {
        if (
          session.userId === input.where.userId &&
          session.revokedAt === input.where.revokedAt &&
          matchesSessionId(session.id, input.where.id)
        ) {
          session.revokedAt = input.data.revokedAt;
          count += 1;
        }
      });

      return { count };
    }
  };

  $transaction<T>(callback: (tx: {
    session: FakePrismaService["session"];
    user: FakePrismaService["user"];
  }) => Promise<T>): Promise<T> {
    return callback({
      session: this.session,
      user: this.user
    });
  }
}

class FakeAuditService {
  readonly events: FakeAuditEvent[] = [];

  async record(input: FakeAuditEvent): Promise<void> {
    this.events.push(input);
  }
}

class FakePasswordService {
  hashPassword(password: string): Promise<string> {
    return Promise.resolve(`hash:${password}`);
  }

  verifyPassword(password: string, hash: string): Promise<boolean> {
    return Promise.resolve(password === "current-password" && hash === "hash:old-password");
  }
}

class FakeConfigService {}
class FakeTokenService {}

describe("AuthService security settings", () => {
  let auditService: FakeAuditService;
  let prisma: FakePrismaService;
  let service: AuthService;
  const authUser: AuthenticatedUser = {
    email: "user@example.com",
    sessionId: "session-current",
    userId: "user-1"
  };

  beforeEach(() => {
    auditService = new FakeAuditService();
    prisma = new FakePrismaService();
    service = new AuthService(
      auditService as unknown as AuditService,
      new FakeConfigService() as unknown as ConfigService,
      new FakePasswordService() as unknown as PasswordService,
      prisma as unknown as PrismaService,
      new FakeTokenService() as unknown as TokenService
    );

    prisma.users.set("user-1", {
      deletedAt: null,
      id: "user-1",
      passwordHash: "hash:old-password",
      status: "active"
    });
    seedSession(prisma, {
      id: "session-current",
      userId: "user-1"
    });
    seedSession(prisma, {
      id: "session-other",
      userId: "user-1",
      userAgent: "Other Browser"
    });
    seedSession(prisma, {
      id: "session-other-user",
      userId: "user-2"
    });
  });

  it("changes password while keeping current session active and revoking only other sessions", async () => {
    const result = await service.changePassword(authUser, {
      currentPassword: "current-password",
      newPassword: "new-password"
    });

    expect(result).toEqual({
      revokedCount: 1,
      success: true
    });
    expect(prisma.users.get("user-1")?.passwordHash).toBe("hash:new-password");
    expect(prisma.sessions.get("session-current")?.revokedAt).toBeNull();
    expect(prisma.sessions.get("session-other")?.revokedAt).toBeInstanceOf(Date);
    expect(prisma.sessions.get("session-other-user")?.revokedAt).toBeNull();
    expect(JSON.stringify(auditService.events)).not.toContain("current-password");
    expect(JSON.stringify(auditService.events)).not.toContain("new-password");
    expect(JSON.stringify(auditService.events)).not.toContain("hash:");
  });

  it("rejects change password when the current password is invalid", async () => {
    await expect(service.changePassword(authUser, {
      currentPassword: "wrong-password",
      newPassword: "new-password"
    })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("lists active user sessions without token or hash material", async () => {
    seedSession(prisma, {
      expiresAt: "2026-06-03T00:00:00.000Z",
      id: "session-expired",
      userId: "user-1"
    });
    const longUserAgent = `Browser\t${"x".repeat(200)}`;
    seedSession(prisma, {
      id: "session-long-agent",
      userAgent: longUserAgent,
      userId: "user-1"
    });

    const response = await service.listSessions(authUser, new Date("2026-06-04T00:00:00.000Z"));

    expect(response.items.some((session) => session.sessionId === "session-expired")).toBe(false);
    expect(response.items.some((session) => session.sessionId === "session-other-user")).toBe(false);
    expect(response.items.find((session) => session.sessionId === "session-current")?.isCurrent).toBe(true);
    expect(response.items.find((session) => session.sessionId === "session-long-agent")?.userAgent?.length).toBeLessThanOrEqual(160);
    expect(JSON.stringify(response)).not.toContain("refresh");
    expect(JSON.stringify(response)).not.toContain("hash");
  });

  it("denies current-session and cross-user revocation", async () => {
    await expect(service.revokeSession(authUser, "session-current")).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.revokeSession(authUser, "session-other-user")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("revokes one owned non-current session", async () => {
    const result = await service.revokeSession(authUser, "session-other");

    expect(result).toEqual({
      revokedCount: 1,
      success: true
    });
    expect(prisma.sessions.get("session-other")?.revokedAt).toBeInstanceOf(Date);
    expect(auditService.events[0]).toMatchObject({
      eventType: "session_revoke",
      metadata: {
        revokedCount: 1
      },
      userId: "user-1"
    });
  });
});

function seedSession(
  prisma: FakePrismaService,
  input: {
    expiresAt?: string;
    id: string;
    revokedAt?: Date | null;
    userAgent?: string | null;
    userId: string;
  }
): void {
  prisma.sessions.set(input.id, {
    createdAt: new Date("2026-06-04T00:00:00.000Z"),
    expiresAt: new Date(input.expiresAt ?? "2026-06-11T00:00:00.000Z"),
    id: input.id,
    refreshTokenHash: "refresh-token-hash",
    revokedAt: input.revokedAt ?? null,
    userAgent: input.userAgent ?? "Current Browser",
    userId: input.userId
  });
}

function matchesSessionId(sessionId: string, condition: string | { not: string } | undefined): boolean {
  if (condition === undefined) {
    return true;
  }

  if (typeof condition === "string") {
    return sessionId === condition;
  }

  return sessionId !== condition.not;
}
