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
}
