import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";

export type AccountResponse = {
  archivedAt: string | null;
  currency: string;
  currentBalance: string;
  id: string;
  includeInNetWorth: boolean;
  initialBalance: string;
  institutionName: string | null;
  name: string;
  sortOrder: number;
  type: string;
};

export type AccountListResponse = {
  items: AccountResponse[];
};

export type AccountDeleteResponse = {
  mode: "archived";
  success: true;
};

type AccountRecord = {
  archivedAt: Date | null;
  currency: string;
  currentBalance: Prisma.Decimal;
  id: string;
  includeInNetWorth: boolean;
  initialBalance: Prisma.Decimal;
  institutionName: string | null;
  name: string;
  sortOrder: number;
  type: string;
};

@Injectable()
export class AccountsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listAccounts(userId: string): Promise<AccountListResponse> {
    const accounts = await this.prisma.account.findMany({
      orderBy: [
        {
          sortOrder: "asc"
        },
        {
          createdAt: "asc"
        }
      ],
      where: {
        archivedAt: null,
        deletedAt: null,
        userId
      }
    });

    return {
      items: accounts.map((account) => this.toResponse(account))
    };
  }

  async createAccount(userId: string, dto: CreateAccountDto): Promise<AccountResponse> {
    const initialBalance = new Prisma.Decimal(dto.initialBalance);
    const account = await this.prisma.account.create({
      data: {
        currency: dto.currency,
        currentBalance: initialBalance,
        includeInNetWorth: dto.includeInNetWorth ?? true,
        initialBalance,
        institutionName: dto.institutionName?.trim(),
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? 0,
        type: dto.type,
        userId
      }
    });

    await this.auditService.record({
      entityId: account.id,
      entityType: "account",
      eventType: "account_create",
      userId
    });

    return this.toResponse(account);
  }

  async updateAccount(
    userId: string,
    accountId: string,
    dto: UpdateAccountDto
  ): Promise<AccountResponse> {
    await this.assertActiveAccount(userId, accountId);

    const account = await this.prisma.account.update({
      data: {
        includeInNetWorth: dto.includeInNetWorth,
        institutionName: dto.institutionName?.trim(),
        name: dto.name?.trim(),
        sortOrder: dto.sortOrder
      },
      where: {
        id: accountId
      }
    });

    await this.auditService.record({
      entityId: account.id,
      entityType: "account",
      eventType: "account_update",
      userId
    });

    return this.toResponse(account);
  }

  async archiveAccount(userId: string, accountId: string): Promise<AccountDeleteResponse> {
    await this.assertActiveAccount(userId, accountId);

    const account = await this.prisma.account.update({
      data: {
        archivedAt: new Date()
      },
      where: {
        id: accountId
      }
    });

    await this.auditService.record({
      entityId: account.id,
      entityType: "account",
      eventType: "account_archive",
      userId
    });

    return {
      mode: "archived",
      success: true
    };
  }

  private async assertActiveAccount(userId: string, accountId: string): Promise<void> {
    const account = await this.prisma.account.findFirst({
      select: {
        id: true
      },
      where: {
        archivedAt: null,
        deletedAt: null,
        id: accountId,
        userId
      }
    });

    if (account === null) {
      throw new NotFoundException("Account not found");
    }
  }

  private toResponse(account: AccountRecord): AccountResponse {
    return {
      archivedAt: account.archivedAt?.toISOString() ?? null,
      currency: account.currency,
      currentBalance: account.currentBalance.toFixed(4),
      id: account.id,
      includeInNetWorth: account.includeInNetWorth,
      initialBalance: account.initialBalance.toFixed(4),
      institutionName: account.institutionName,
      name: account.name,
      sortOrder: account.sortOrder,
      type: account.type
    };
  }
}
