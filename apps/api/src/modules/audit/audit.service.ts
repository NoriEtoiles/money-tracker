import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type AuditInput = {
  entityId?: string;
  entityType?: string;
  eventType: string;
  ipAddress?: string;
  metadata?: Prisma.InputJsonValue;
  userAgent?: string;
  userId?: string;
};

export type AuditEventResponse = {
  createdAt: string;
  entityType: string | null;
  eventType: string;
  metadata: Record<string, unknown>;
};

export type AuditEventListQuery = {
  cursor?: string;
  limit?: number;
};

export type AuditEventListResponse = {
  items: AuditEventResponse[];
  nextCursor: string | null;
};

const safeMetadataKeys = new Set([
  "categoryCount",
  "completedAt",
  "currency",
  "errorCode",
  "expenseRowCount",
  "exportType",
  "importedRowCount",
  "incomeRowCount",
  "invalidRowCount",
  "mode",
  "recurringOccurrenceAt",
  "requestedAt",
  "revokedCount",
  "revokedSessionCount",
  "rowCount",
  "status",
  "totalRowCount",
  "transactionType",
  "validRowCount"
]);

const safeFilterKeys = new Set(["currency", "dateFrom", "dateTo", "transactionType"]);
const safeChangedFields = new Set(["defaultCurrency", "displayName", "locale", "timezone"]);

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        entityId: input.entityId,
        entityType: input.entityType,
        eventType: input.eventType,
        ipAddress: input.ipAddress,
        metadata: input.metadata ?? {},
        userAgent: input.userAgent,
        userId: input.userId
      }
    });
  }

  async listForUser(
    userId: string,
    query: AuditEventListQuery
  ): Promise<AuditEventListResponse> {
    const limit = query.limit ?? 30;
    const events = await this.prisma.auditEvent.findMany({
      cursor: query.cursor !== undefined ? { id: query.cursor } : undefined,
      orderBy: [
        {
          createdAt: "desc"
        },
        {
          id: "desc"
        }
      ],
      skip: query.cursor !== undefined ? 1 : 0,
      take: limit + 1,
      where: {
        userId
      }
    });
    const hasNextPage = events.length > limit;
    const items = events.slice(0, limit);

    return {
      items: items.map((event) => ({
        createdAt: event.createdAt.toISOString(),
        entityType: event.entityType,
        eventType: event.eventType,
        metadata: this.sanitizeMetadata(event.metadata)
      })),
      nextCursor: hasNextPage ? items[items.length - 1]?.id ?? null : null
    };
  }

  private sanitizeMetadata(metadata: Prisma.JsonValue): Record<string, unknown> {
    if (!this.isObject(metadata)) {
      return {};
    }

    const safe: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (key === "changedFields") {
        const changedFields = this.sanitizeChangedFields(value);

        if (changedFields.length > 0) {
          safe.changedFields = changedFields;
        }
        continue;
      }

      if (key === "filters") {
        const filters = this.sanitizeFilters(value);

        if (Object.keys(filters).length > 0) {
          safe.filters = filters;
        }
        continue;
      }

      if (safeMetadataKeys.has(key) && this.isSafePrimitive(value)) {
        safe[key] = value;
      }
    }

    return safe;
  }

  private sanitizeChangedFields(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((field): field is string =>
      typeof field === "string" && safeChangedFields.has(field)
    );
  }

  private sanitizeFilters(value: unknown): Record<string, string> {
    if (!this.isObject(value)) {
      return {};
    }

    const filters: Record<string, string> = {};

    for (const [key, filterValue] of Object.entries(value)) {
      if (safeFilterKeys.has(key) && typeof filterValue === "string") {
        filters[key] = filterValue;
      }
    }

    return filters;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private isSafePrimitive(value: unknown): value is boolean | number | string | null {
    return value === null || ["boolean", "number", "string"].includes(typeof value);
  }
}
