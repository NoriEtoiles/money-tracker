import { beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { UsersService } from "./users.service";

type FakeUser = {
  defaultCurrency: string;
  deletedAt: Date | null;
  displayName: string;
  email: string;
  id: string;
  locale: string;
  status: string;
  timezone: string;
};

type FakeAuditEvent = {
  entityId?: string;
  entityType?: string;
  eventType: string;
  metadata?: unknown;
  userId?: string;
};

class FakePrismaService {
  readonly users = new Map<string, FakeUser>();

  readonly user = {
    findFirst: async (input: {
      where: { deletedAt: Date | null; id: string; status: string };
    }): Promise<FakeUser | null> => {
      const user = this.users.get(input.where.id);

      return user !== undefined &&
        user.deletedAt === input.where.deletedAt &&
        user.status === input.where.status
        ? { ...user }
        : null;
    },
    update: async (input: {
      data: Partial<Pick<FakeUser, "defaultCurrency" | "displayName" | "locale" | "timezone">>;
      where: { id: string };
    }): Promise<FakeUser> => {
      const user = this.users.get(input.where.id);

      if (user === undefined) {
        throw new Error("Missing fake user");
      }

      Object.assign(user, removeUndefined(input.data));

      return { ...user };
    }
  };
}

class FakeAuditService {
  readonly events: FakeAuditEvent[] = [];

  async record(input: FakeAuditEvent): Promise<void> {
    this.events.push(input);
  }
}

describe("UsersService", () => {
  let auditService: FakeAuditService;
  let prisma: FakePrismaService;
  let service: UsersService;

  beforeEach(() => {
    auditService = new FakeAuditService();
    prisma = new FakePrismaService();
    service = new UsersService(
      auditService as unknown as AuditService,
      prisma as unknown as PrismaService
    );

    prisma.users.set("user-1", {
      defaultCurrency: "IDR",
      deletedAt: null,
      displayName: "Old Name",
      email: "user@example.com",
      id: "user-1",
      locale: "id-ID",
      status: "active",
      timezone: "Asia/Jakarta"
    });
  });

  it("audits profile update changed field names without old or new values", async () => {
    await service.updateProfile("user-1", {
      displayName: "New Name"
    });

    expect(auditService.events).toEqual([
      {
        entityId: "user-1",
        entityType: "user",
        eventType: "profile_update",
        metadata: {
          changedFields: ["displayName"]
        },
        userId: "user-1"
      }
    ]);

    const serializedAudit = JSON.stringify(auditService.events);

    expect(serializedAudit).not.toContain("Old Name");
    expect(serializedAudit).not.toContain("New Name");
  });

  it("does not emit a profile update audit event when fields do not change", async () => {
    await service.updateProfile("user-1", {
      defaultCurrency: "IDR",
      displayName: "Old Name",
      locale: "id-ID",
      timezone: "Asia/Jakarta"
    });

    expect(auditService.events).toHaveLength(0);
  });
});

function removeUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as Partial<T>;
}
