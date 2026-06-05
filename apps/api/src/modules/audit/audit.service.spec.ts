import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "./audit.service";

type FakeAuditEvent = {
  createdAt: Date;
  entityId: string | null;
  entityType: string | null;
  eventType: string;
  id: string;
  metadata: Prisma.JsonValue;
  userId: string | null;
};

class FakePrismaService {
  readonly events: FakeAuditEvent[] = [];

  readonly auditEvent = {
    create: async (input: {
      data: {
        entityId?: string;
        entityType?: string;
        eventType: string;
        ipAddress?: string;
        metadata: Prisma.InputJsonValue;
        userAgent?: string;
        userId?: string;
      };
    }): Promise<FakeAuditEvent> => {
      const event: FakeAuditEvent = {
        createdAt: new Date("2026-06-04T00:00:00.000Z"),
        entityId: input.data.entityId ?? null,
        entityType: input.data.entityType ?? null,
        eventType: input.data.eventType,
        id: `audit-${this.events.length + 1}`,
        metadata: input.data.metadata as Prisma.JsonValue,
        userId: input.data.userId ?? null
      };

      this.events.push(event);

      return event;
    },
    findMany: async (input: {
      cursor?: { id: string };
      skip?: number;
      take: number;
      where: { userId: string };
    }): Promise<FakeAuditEvent[]> => {
      const sortedEvents = this.events
        .filter((event) => event.userId === input.where.userId)
        .sort((left, right) => {
          const createdAtDifference = right.createdAt.getTime() - left.createdAt.getTime();

          return createdAtDifference !== 0 ? createdAtDifference : right.id.localeCompare(left.id);
        });
      const cursorIndex = input.cursor === undefined
        ? -1
        : sortedEvents.findIndex((event) => event.id === input.cursor?.id);
      const start = cursorIndex >= 0 ? cursorIndex + (input.skip ?? 0) : 0;

      return sortedEvents.slice(start, start + input.take);
    }
  };
}

describe("AuditService", () => {
  let prisma: FakePrismaService;
  let service: AuditService;

  beforeEach(() => {
    prisma = new FakePrismaService();
    service = new AuditService(prisma as unknown as PrismaService);
  });

  it("returns only the authenticated user's audit events", async () => {
    seedAuditEvent(prisma, {
      eventType: "login",
      id: "audit-user-1",
      userId: "user-1"
    });
    seedAuditEvent(prisma, {
      eventType: "login",
      id: "audit-user-2",
      userId: "user-2"
    });

    const response = await service.listForUser("user-1", {});

    expect(response.items).toHaveLength(1);
    expect(response.items[0]?.eventType).toBe("login");
  });

  it("sanitizes unsafe historical metadata with an explicit whitelist", async () => {
    seedAuditEvent(prisma, {
      eventType: "csv_export_download",
      id: "audit-unsafe",
      metadata: {
        changedFields: ["displayName", "passwordHash"],
        csvContent: "transaction_id,secret",
        email: "user@example.com",
        filters: {
          accountId: "account-secret",
          currency: "IDR",
          dateFrom: "2026-06-01",
          rawUrl: "https://example.com/download?token=secret"
        },
        merchant: "Sensitive merchant",
        nested: {
          token: "secret"
        },
        note: "Sensitive note",
        rawRequestBody: {
          currentPassword: "secret"
        },
        rowCount: 7,
        serverPath: "C:\\secrets\\export.csv",
        status: "downloaded",
        token: "secret"
      },
      userId: "user-1"
    });

    const response = await service.listForUser("user-1", {});

    expect(response.items[0]?.metadata).toEqual({
      changedFields: ["displayName"],
      filters: {
        currency: "IDR",
        dateFrom: "2026-06-01"
      },
      rowCount: 7,
      status: "downloaded"
    });

    const serialized = JSON.stringify(response);

    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("Sensitive merchant");
    expect(serialized).not.toContain("Sensitive note");
    expect(serialized).not.toContain("download?token");
    expect(serialized).not.toContain("user@example.com");
    expect(serialized).not.toContain("serverPath");
  });

  it("paginates audit events by cursor", async () => {
    seedAuditEvent(prisma, {
      createdAt: "2026-06-04T00:03:00.000Z",
      eventType: "third",
      id: "audit-3",
      userId: "user-1"
    });
    seedAuditEvent(prisma, {
      createdAt: "2026-06-04T00:02:00.000Z",
      eventType: "second",
      id: "audit-2",
      userId: "user-1"
    });
    seedAuditEvent(prisma, {
      createdAt: "2026-06-04T00:01:00.000Z",
      eventType: "first",
      id: "audit-1",
      userId: "user-1"
    });

    const firstPage = await service.listForUser("user-1", { limit: 2 });
    const secondPage = await service.listForUser("user-1", {
      cursor: firstPage.nextCursor ?? undefined,
      limit: 2
    });

    expect(firstPage.items.map((event) => event.eventType)).toEqual(["third", "second"]);
    expect(firstPage.nextCursor).toBe("audit-2");
    expect(secondPage.items.map((event) => event.eventType)).toEqual(["first"]);
    expect(secondPage.nextCursor).toBeNull();
  });
});

function seedAuditEvent(
  prisma: FakePrismaService,
  input: {
    createdAt?: string;
    eventType: string;
    id: string;
    metadata?: Prisma.JsonValue;
    userId: string;
  }
): void {
  prisma.events.push({
    createdAt: new Date(input.createdAt ?? "2026-06-04T00:00:00.000Z"),
    entityId: null,
    entityType: null,
    eventType: input.eventType,
    id: input.id,
    metadata: input.metadata ?? {},
    userId: input.userId
  });
}
