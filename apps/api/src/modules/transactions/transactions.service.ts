import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { ListTransactionsDto } from "./dto/list-transactions.dto";
import { transactionTypes, TransactionType } from "./dto/transaction-type";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";

export type TransactionResponse = {
  account: {
    id: string;
    name: string;
  };
  amount: string;
  category: {
    id: string;
    name: string;
  } | null;
  currency: string;
  id: string;
  merchant: string | null;
  note: string | null;
  status: string;
  transactionAt: string;
  type: TransactionType;
};

export type TransactionListResponse = {
  items: TransactionResponse[];
  nextCursor: string | null;
};

export type TransactionDeleteResponse = {
  mode: "soft_deleted";
  success: true;
};

type ActiveAccount = {
  currency: string;
  id: string;
  name: string;
};

type ActiveCategory = {
  id: string;
  kind: string;
  name: string;
};

type TransactionRecord = Prisma.TransactionGetPayload<{
  include: {
    account: {
      select: {
        id: true;
        name: true;
      };
    };
    category: {
      select: {
        id: true;
        kind: true;
        name: true;
      };
    };
  };
}>;

@Injectable()
export class TransactionsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listTransactions(
    userId: string,
    dto: ListTransactionsDto
  ): Promise<TransactionListResponse> {
    const limit = dto.limit ?? 30;
    const where = this.buildListWhere(userId, dto);
    const transactions = await this.prisma.transaction.findMany({
      cursor: dto.cursor !== undefined ? { id: dto.cursor } : undefined,
      include: this.transactionInclude,
      orderBy: [
        {
          transactionAt: "desc"
        },
        {
          createdAt: "desc"
        }
      ],
      skip: dto.cursor !== undefined ? 1 : 0,
      take: limit + 1,
      where
    });
    const hasNextPage = transactions.length > limit;
    const items = transactions.slice(0, limit);

    return {
      items: items.map((transaction) => this.toResponse(transaction)),
      nextCursor: hasNextPage ? items[items.length - 1]?.id ?? null : null
    };
  }

  async createTransaction(
    userId: string,
    dto: CreateTransactionDto
  ): Promise<TransactionResponse> {
    const amount = this.parsePositiveAmount(dto.amount);
    const transaction = await this.prisma.$transaction(async (tx) => {
      const account = await this.assertActiveAccount(tx, userId, dto.accountId);
      this.assertCurrencyMatchesAccount(account, dto.currency);

      if (dto.categoryId !== undefined) {
        await this.assertActiveCategory(tx, userId, dto.categoryId, dto.type);
      }

      const createdTransaction = await tx.transaction.create({
        data: {
          accountId: account.id,
          amount,
          categoryId: dto.categoryId,
          currency: dto.currency,
          merchant: this.trimOptional(dto.merchant),
          note: this.trimOptional(dto.note),
          transactionAt: new Date(dto.transactionAt),
          type: dto.type,
          userId
        },
        include: this.transactionInclude
      });

      await this.applyBalanceDelta(tx, account.id, this.toBalanceDelta(dto.type, amount));

      return createdTransaction;
    });

    await this.auditService.record({
      entityId: transaction.id,
      entityType: "transaction",
      eventType: "transaction_create",
      userId
    });

    return this.toResponse(transaction);
  }

  async updateTransaction(
    userId: string,
    transactionId: string,
    dto: UpdateTransactionDto
  ): Promise<TransactionResponse> {
    const transaction = await this.prisma.$transaction(async (tx) => {
      const existingTransaction = await this.assertActiveTransaction(tx, userId, transactionId);
      const nextType = dto.type ?? existingTransaction.type as TransactionType;
      const nextAmount = dto.amount !== undefined
        ? this.parsePositiveAmount(dto.amount)
        : existingTransaction.amount;
      const nextAccountId = dto.accountId ?? existingTransaction.accountId;
      const nextCurrency = dto.currency ?? existingTransaction.currency;
      const categoryWasProvided = Object.prototype.hasOwnProperty.call(dto, "categoryId");
      const nextCategoryId = categoryWasProvided
        ? dto.categoryId ?? null
        : existingTransaction.categoryId;

      const nextAccount = await this.assertActiveAccount(tx, userId, nextAccountId);
      this.assertCurrencyMatchesAccount(nextAccount, nextCurrency);

      if (nextCategoryId !== null) {
        await this.assertActiveCategory(tx, userId, nextCategoryId, nextType);
      }

      const oldDelta = this.toBalanceDelta(
        existingTransaction.type as TransactionType,
        existingTransaction.amount
      );
      const newDelta = this.toBalanceDelta(nextType, nextAmount);

      if (existingTransaction.accountId === nextAccount.id) {
        await this.applyBalanceDelta(tx, nextAccount.id, newDelta.minus(oldDelta));
      } else {
        await this.applyBalanceDelta(tx, existingTransaction.accountId, oldDelta.negated());
        await this.applyBalanceDelta(tx, nextAccount.id, newDelta);
      }

      return tx.transaction.update({
        data: {
          accountId: nextAccount.id,
          amount: nextAmount,
          categoryId: nextCategoryId,
          currency: nextCurrency,
          merchant: this.nextNullableString(dto.merchant),
          note: this.nextNullableString(dto.note),
          transactionAt: dto.transactionAt !== undefined
            ? new Date(dto.transactionAt)
            : undefined,
          type: nextType
        },
        include: this.transactionInclude,
        where: {
          id: transactionId
        }
      });
    });

    await this.auditService.record({
      entityId: transaction.id,
      entityType: "transaction",
      eventType: "transaction_update",
      userId
    });

    return this.toResponse(transaction);
  }

  async deleteTransaction(
    userId: string,
    transactionId: string
  ): Promise<TransactionDeleteResponse> {
    const transaction = await this.prisma.$transaction(async (tx) => {
      const existingTransaction = await this.assertActiveTransaction(tx, userId, transactionId);
      const oldDelta = this.toBalanceDelta(
        existingTransaction.type as TransactionType,
        existingTransaction.amount
      );

      await this.applyBalanceDelta(tx, existingTransaction.accountId, oldDelta.negated());

      return tx.transaction.update({
        data: {
          deletedAt: new Date(),
          isDeleted: true
        },
        where: {
          id: transactionId
        }
      });
    });

    await this.auditService.record({
      entityId: transaction.id,
      entityType: "transaction",
      eventType: "transaction_delete",
      userId
    });

    return {
      mode: "soft_deleted",
      success: true
    };
  }

  private readonly transactionInclude = {
    account: {
      select: {
        id: true,
        name: true
      }
    },
    category: {
      select: {
        id: true,
        kind: true,
        name: true
      }
    }
  } satisfies Prisma.TransactionInclude;

  private buildListWhere(userId: string, dto: ListTransactionsDto): Prisma.TransactionWhereInput {
    return {
      accountId: dto.accountId,
      amount: {
        gte: dto.minAmount !== undefined ? this.parseNonNegativeAmount(dto.minAmount) : undefined,
        lte: dto.maxAmount !== undefined ? this.parseNonNegativeAmount(dto.maxAmount) : undefined
      },
      categoryId: dto.categoryId,
      isDeleted: false,
      deletedAt: null,
      transferGroupId: null,
      transferSide: null,
      transactionAt: {
        gte: dto.dateFrom !== undefined ? new Date(dto.dateFrom) : undefined,
        lte: dto.dateTo !== undefined ? new Date(dto.dateTo) : undefined
      },
      type: dto.type ?? {
        in: [...transactionTypes]
      },
      userId,
      OR: dto.search !== undefined && dto.search.trim().length > 0
        ? [
            {
              merchant: {
                contains: dto.search.trim(),
                mode: "insensitive"
              }
            },
            {
              note: {
                contains: dto.search.trim(),
                mode: "insensitive"
              }
            }
          ]
        : undefined
    };
  }

  private async assertActiveAccount(
    tx: Prisma.TransactionClient,
    userId: string,
    accountId: string
  ): Promise<ActiveAccount> {
    const account = await tx.account.findFirst({
      select: {
        currency: true,
        id: true,
        name: true
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

    return account;
  }

  private async assertActiveCategory(
    tx: Prisma.TransactionClient,
    userId: string,
    categoryId: string,
    transactionType: TransactionType
  ): Promise<ActiveCategory> {
    const category = await tx.category.findFirst({
      select: {
        id: true,
        kind: true,
        name: true
      },
      where: {
        archivedAt: null,
        deletedAt: null,
        id: categoryId,
        userId
      }
    });

    if (category === null) {
      throw new NotFoundException("Category not found");
    }

    if (category.kind !== transactionType) {
      throw new BadRequestException("Category kind must match transaction type");
    }

    return category;
  }

  private async assertActiveTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    transactionId: string
  ): Promise<TransactionRecord> {
    const transaction = await tx.transaction.findFirst({
      include: this.transactionInclude,
      where: {
        deletedAt: null,
        id: transactionId,
        isDeleted: false,
        transferGroupId: null,
        transferSide: null,
        type: {
          in: [...transactionTypes]
        },
        userId
      }
    });

    if (transaction === null) {
      throw new NotFoundException("Transaction not found");
    }

    return transaction;
  }

  private assertCurrencyMatchesAccount(account: ActiveAccount, currency: string): void {
    if (account.currency !== currency) {
      throw new BadRequestException("Transaction currency must match account currency");
    }
  }

  private async applyBalanceDelta(
    tx: Prisma.TransactionClient,
    accountId: string,
    delta: Prisma.Decimal
  ): Promise<void> {
    await tx.account.update({
      data: {
        currentBalance: {
          increment: delta
        }
      },
      where: {
        id: accountId
      }
    });
  }

  private parsePositiveAmount(value: string): Prisma.Decimal {
    const amount = new Prisma.Decimal(value);

    if (amount.lte(0)) {
      throw new BadRequestException("Amount must be greater than 0");
    }

    return amount;
  }

  private parseNonNegativeAmount(value: string): Prisma.Decimal {
    const amount = new Prisma.Decimal(value);

    if (amount.lt(0)) {
      throw new BadRequestException("Amount must be greater than or equal to 0");
    }

    return amount;
  }

  private toBalanceDelta(type: TransactionType, amount: Prisma.Decimal): Prisma.Decimal {
    return type === "income" ? amount : amount.negated();
  }

  private trimOptional(value: string | undefined): string | undefined {
    const trimmed = value?.trim();

    return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
  }

  private nextNullableString(value: string | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
  }

  private toResponse(transaction: TransactionRecord): TransactionResponse {
    return {
      account: {
        id: transaction.account.id,
        name: transaction.account.name
      },
      amount: transaction.amount.toFixed(4),
      category: transaction.category === null
        ? null
        : {
            id: transaction.category.id,
            name: transaction.category.name
          },
      currency: transaction.currency,
      id: transaction.id,
      merchant: transaction.merchant,
      note: transaction.note,
      status: transaction.status,
      transactionAt: transaction.transactionAt.toISOString(),
      type: transaction.type as TransactionType
    };
  }
}
