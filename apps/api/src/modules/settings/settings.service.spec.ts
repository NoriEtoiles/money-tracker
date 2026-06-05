import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { PasswordService } from "../auth/password.service";
import { SettingsService } from "./settings.service";

type FakeUser = {
  deletedAt: Date | null;
  id: string;
  passwordHash: string | null;
  status: string;
};

type FakeDeletionRequest = {
  id: string;
  requestedAt: Date;
  status: string;
  userId: string;
};

type FakeAuditEvent = {
  entityType?: string;
  eventType: string;
  metadata?: unknown;
  userId?: string;
};

class FakePrismaService {
  createThrowsUniqueOnce = false;
  findRequestCalls = 0;
  readonly requests: FakeDeletionRequest[] = [];
  readonly users = new Map<string, FakeUser>();

  readonly user = {
    findFirst: async (input: {
      where: { deletedAt: Date | null; id: string; status: string };
    }): Promise<Pick<FakeUser, "passwordHash"> | null> => {
      const user = this.users.get(input.where.id);

      return user !== undefined &&
        user.deletedAt === input.where.deletedAt &&
        user.status === input.where.status
        ? {
            passwordHash: user.passwordHash
          }
        : null;
    }
  };

  readonly accountDeletionRequest = {
    create: async (input: {
      data: {
        status: string;
        userId: string;
      };
    }): Promise<FakeDeletionRequest> => {
      if (this.createThrowsUniqueOnce) {
        this.createThrowsUniqueOnce = false;
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          clientVersion: "test",
          code: "P2002"
        });
      }

      const request: FakeDeletionRequest = {
        id: `request-${this.requests.length + 1}`,
        requestedAt: new Date("2026-06-04T00:00:00.000Z"),
        status: input.data.status,
        userId: input.data.userId
      };

      this.requests.push(request);

      return request;
    },
    findFirst: async (input: {
      where: {
        status: string;
        userId: string;
      };
    }): Promise<FakeDeletionRequest | null> => {
      this.findRequestCalls += 1;

      if (this.createThrowsUniqueOnce && this.findRequestCalls === 1) {
        return null;
      }

      return this.requests.find((request) =>
        request.status === input.where.status && request.userId === input.where.userId
      ) ?? null;
    }
  };
}

class FakeAuditService {
  readonly events: FakeAuditEvent[] = [];

  async record(input: FakeAuditEvent): Promise<void> {
    this.events.push(input);
  }
}

class FakePasswordService {
  verifyPassword(password: string, hash: string): Promise<boolean> {
    return Promise.resolve(password === "current-password" && hash === "hash:old-password");
  }
}

describe("SettingsService", () => {
  let auditService: FakeAuditService;
  let prisma: FakePrismaService;
  let service: SettingsService;

  beforeEach(() => {
    auditService = new FakeAuditService();
    prisma = new FakePrismaService();
    service = new SettingsService(
      auditService as unknown as AuditService,
      new FakePasswordService() as unknown as PasswordService,
      prisma as unknown as PrismaService
    );
    prisma.users.set("user-1", {
      deletedAt: null,
      id: "user-1",
      passwordHash: "hash:old-password",
      status: "active"
    });
  });

  it("creates an idempotent delete account request without storing password or phrase", async () => {
    const input = {
      confirmationPhrase: "DELETE MY ACCOUNT",
      currentPassword: "current-password"
    };

    const first = await service.requestAccountDeletion("user-1", input);
    const second = await service.requestAccountDeletion("user-1", input);

    expect(first).toEqual(second);
    expect(prisma.requests).toHaveLength(1);
    expect(auditService.events).toHaveLength(1);
    expect(auditService.events[0]).toMatchObject({
      eventType: "delete_account_request",
      metadata: {
        status: "pending"
      },
      userId: "user-1"
    });
    expect(JSON.stringify(auditService.events)).not.toContain("DELETE MY ACCOUNT");
    expect(JSON.stringify(auditService.events)).not.toContain("current-password");
  });

  it("rejects invalid confirmation phrase and current password", async () => {
    await expect(service.requestAccountDeletion("user-1", {
      confirmationPhrase: "delete",
      currentPassword: "current-password"
    })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.requestAccountDeletion("user-1", {
      confirmationPhrase: "DELETE MY ACCOUNT",
      currentPassword: "wrong-password"
    })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("returns the existing pending request when a unique race occurs", async () => {
    prisma.createThrowsUniqueOnce = true;
    prisma.requests.push({
      id: "request-existing",
      requestedAt: new Date("2026-06-04T01:00:00.000Z"),
      status: "pending",
      userId: "user-1"
    });

    const response = await service.requestAccountDeletion("user-1", {
      confirmationPhrase: "DELETE MY ACCOUNT",
      currentPassword: "current-password"
    });

    expect(response.request).toEqual({
      requestedAt: "2026-06-04T01:00:00.000Z",
      status: "pending"
    });
    expect(auditService.events).toHaveLength(0);
  });
});
