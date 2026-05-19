import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { ListTransfersDto } from "./dto/list-transfers.dto";
import { UpdateTransferDto } from "./dto/update-transfer.dto";

export type TransferResponse = {
  amount: string;
  currency: string;
  fromAccount: {
    id: string;
    name: string;
  };
  inflowTransactionId: string;
  note: string | null;
  outflowTransactionId: string;
  status: string;
  toAccount: {
    id: string;
    name: string;
  };
  transactionAt: string;
  transferGroupId: string;
};

export type TransferListResponse = {
  items: TransferResponse[];
  nextCursor: string | null;
};

export type TransferDeleteResponse = {
  mode: "soft_deleted";
  success: true;
};

type ActiveAccount = {
  currency: string;
  id: string;
  name: string;
};

type TransferLeg = Prisma.TransactionGetPayload<{
  include: {
    account: {
      select: {
        currency: true;
        id: true;
        name: true;
      };
    };
  };
}>;

type TransferPair = {
  inflow: TransferLeg;
  outflow: TransferLeg;
};

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async listTransfers(
    userId: string,
    dto: ListTransfersDto
  ): Promise<TransferListResponse> {
    const limit = dto.limit ?? 30;
    const outflows = await this.prisma.transaction.findMany({
      cursor: dto.cursor !== undefined ? { id: dto.cursor } : undefined,
      include: this.transferInclude,
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
      where: {
        deletedAt: null,
        isDeleted: false,
        transferGroupId: {
          not: null
        },
        transferSide: "outflow",
        type: "transfer",
        userId
      }
    });
    const hasNextPage = outflows.length > limit;
    const pageOutflows = outflows.slice(0, limit);
    const transferGroupIds = pageOutflows
      .map((outflow) => outflow.transferGroupId)
      .filter((transferGroupId): transferGroupId is string => transferGroupId !== null);
    const inflows = transferGroupIds.length === 0
      ? []
      : await this.prisma.transaction.findMany({
          include: this.transferInclude,
          where: {
            deletedAt: null,
            isDeleted: false,
            transferGroupId: {
              in: transferGroupIds
            },
            transferSide: "inflow",
            type: "transfer",
            userId
          }
        });
    const inflowsByGroupId = new Map(
      inflows
        .filter((inflow) => inflow.transferGroupId !== null)
        .map((inflow) => [inflow.transferGroupId as string, inflow])
    );
    const items = pageOutflows.flatMap((outflow) => {
      if (outflow.transferGroupId === null) {
        return [];
      }

      const inflow = inflowsByGroupId.get(outflow.transferGroupId);

      return inflow === undefined ? [] : [this.toResponse({ inflow, outflow })];
    });

    return {
      items,
      nextCursor: hasNextPage ? pageOutflows[pageOutflows.length - 1]?.id ?? null : null
    };
  }

  async createTransfer(userId: string, dto: CreateTransferDto): Promise<TransferResponse> {
    const amount = this.parsePositiveAmount(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      const fromAccount = await this.assertActiveAccount(tx, userId, dto.fromAccountId);
      const toAccount = await this.assertActiveAccount(tx, userId, dto.toAccountId);
      this.assertDifferentAccounts(fromAccount.id, toAccount.id);
      this.assertMatchingCurrencies(fromAccount, toAccount);

      const transferGroupId = randomUUID();
      const transactionAt = new Date(dto.transactionAt);
      const note = this.trimOptional(dto.note);
      const outflow = await tx.transaction.create({
        data: {
          accountId: fromAccount.id,
          amount,
          categoryId: null,
          currency: fromAccount.currency,
          note,
          transactionAt,
          transferGroupId,
          transferSide: "outflow",
          type: "transfer",
          userId
        },
        include: this.transferInclude
      });
      const inflow = await tx.transaction.create({
        data: {
          accountId: toAccount.id,
          amount,
          categoryId: null,
          currency: fromAccount.currency,
          note,
          transactionAt,
          transferGroupId,
          transferSide: "inflow",
          type: "transfer",
          userId
        },
        include: this.transferInclude
      });

      await this.applyBalanceDelta(tx, fromAccount.id, amount.negated());
      await this.applyBalanceDelta(tx, toAccount.id, amount);
      await this.recordAudit(tx, userId, "transfer_create", transferGroupId, {
        inflowTransactionId: inflow.id,
        outflowTransactionId: outflow.id
      });

      return this.toResponse({ inflow, outflow });
    });
  }

  async updateTransfer(
    userId: string,
    transferGroupId: string,
    dto: UpdateTransferDto
  ): Promise<TransferResponse> {
    return this.prisma.$transaction(async (tx) => {
      const existingPair = await this.assertActiveTransferPair(tx, userId, transferGroupId);
      const nextAmount = dto.amount !== undefined
        ? this.parsePositiveAmount(dto.amount)
        : existingPair.outflow.amount;
      const nextFromAccountId = dto.fromAccountId ?? existingPair.outflow.accountId;
      const nextToAccountId = dto.toAccountId ?? existingPair.inflow.accountId;
      const nextTransactionAt = dto.transactionAt !== undefined
        ? new Date(dto.transactionAt)
        : existingPair.outflow.transactionAt;
      const nextNote = dto.note !== undefined
        ? this.nextNullableString(dto.note)
        : existingPair.outflow.note;
      const fromAccount = await this.assertActiveAccount(tx, userId, nextFromAccountId);
      const toAccount = await this.assertActiveAccount(tx, userId, nextToAccountId);
      this.assertDifferentAccounts(fromAccount.id, toAccount.id);
      this.assertMatchingCurrencies(fromAccount, toAccount);

      const deltas = new Map<string, Prisma.Decimal>();
      this.addDelta(deltas, existingPair.outflow.accountId, existingPair.outflow.amount);
      this.addDelta(deltas, existingPair.inflow.accountId, existingPair.inflow.amount.negated());
      this.addDelta(deltas, fromAccount.id, nextAmount.negated());
      this.addDelta(deltas, toAccount.id, nextAmount);

      const outflow = await tx.transaction.update({
        data: {
          accountId: fromAccount.id,
          amount: nextAmount,
          currency: fromAccount.currency,
          note: nextNote,
          transactionAt: nextTransactionAt
        },
        include: this.transferInclude,
        where: {
          id: existingPair.outflow.id
        }
      });
      const inflow = await tx.transaction.update({
        data: {
          accountId: toAccount.id,
          amount: nextAmount,
          currency: fromAccount.currency,
          note: nextNote,
          transactionAt: nextTransactionAt
        },
        include: this.transferInclude,
        where: {
          id: existingPair.inflow.id
        }
      });

      await this.applyBalanceDeltas(tx, deltas);
      await this.recordAudit(tx, userId, "transfer_update", transferGroupId, {
        inflowTransactionId: inflow.id,
        outflowTransactionId: outflow.id
      });

      return this.toResponse({ inflow, outflow });
    });
  }

  async deleteTransfer(
    userId: string,
    transferGroupId: string
  ): Promise<TransferDeleteResponse> {
    await this.prisma.$transaction(async (tx) => {
      const existingPair = await this.assertActiveTransferPair(tx, userId, transferGroupId);
      const deletedAt = new Date();

      await this.applyBalanceDelta(tx, existingPair.outflow.accountId, existingPair.outflow.amount);
      await this.applyBalanceDelta(tx, existingPair.inflow.accountId, existingPair.inflow.amount.negated());
      await tx.transaction.update({
        data: {
          deletedAt,
          isDeleted: true
        },
        where: {
          id: existingPair.outflow.id
        }
      });
      await tx.transaction.update({
        data: {
          deletedAt,
          isDeleted: true
        },
        where: {
          id: existingPair.inflow.id
        }
      });
      await this.recordAudit(tx, userId, "transfer_delete", transferGroupId, {
        inflowTransactionId: existingPair.inflow.id,
        outflowTransactionId: existingPair.outflow.id
      });
    });

    return {
      mode: "soft_deleted",
      success: true
    };
  }

  private readonly transferInclude = {
    account: {
      select: {
        currency: true,
        id: true,
        name: true
      }
    }
  } satisfies Prisma.TransactionInclude;

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

  private async assertActiveTransferPair(
    tx: Prisma.TransactionClient,
    userId: string,
    transferGroupId: string
  ): Promise<TransferPair> {
    const legs = await tx.transaction.findMany({
      include: this.transferInclude,
      where: {
        deletedAt: null,
        isDeleted: false,
        transferGroupId,
        type: "transfer",
        userId
      }
    });

    if (legs.length === 0) {
      throw new NotFoundException("Transfer not found");
    }

    const outflow = legs.find((leg) => leg.transferSide === "outflow");
    const inflow = legs.find((leg) => leg.transferSide === "inflow");

    if (legs.length !== 2 || outflow === undefined || inflow === undefined) {
      throw new BadRequestException("Transfer pair is inconsistent");
    }

    this.assertTransferPairConsistent(outflow, inflow);

    return {
      inflow,
      outflow
    };
  }

  private assertTransferPairConsistent(outflow: TransferLeg, inflow: TransferLeg): void {
    if (
      outflow.transferGroupId === null ||
      outflow.transferGroupId !== inflow.transferGroupId ||
      outflow.accountId === inflow.accountId ||
      !outflow.amount.eq(inflow.amount) ||
      outflow.currency !== inflow.currency ||
      outflow.note !== inflow.note ||
      outflow.status !== inflow.status ||
      outflow.transactionAt.getTime() !== inflow.transactionAt.getTime()
    ) {
      throw new BadRequestException("Transfer pair is inconsistent");
    }
  }

  private assertDifferentAccounts(fromAccountId: string, toAccountId: string): void {
    if (fromAccountId === toAccountId) {
      throw new BadRequestException("Transfer accounts must be different");
    }
  }

  private assertMatchingCurrencies(fromAccount: ActiveAccount, toAccount: ActiveAccount): void {
    if (fromAccount.currency !== toAccount.currency) {
      throw new BadRequestException("Transfer accounts must use the same currency");
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

  private async applyBalanceDeltas(
    tx: Prisma.TransactionClient,
    deltas: Map<string, Prisma.Decimal>
  ): Promise<void> {
    for (const [accountId, delta] of deltas) {
      if (!delta.eq(0)) {
        await this.applyBalanceDelta(tx, accountId, delta);
      }
    }
  }

  private addDelta(
    deltas: Map<string, Prisma.Decimal>,
    accountId: string,
    delta: Prisma.Decimal
  ): void {
    deltas.set(accountId, (deltas.get(accountId) ?? new Prisma.Decimal(0)).plus(delta));
  }

  private parsePositiveAmount(value: string): Prisma.Decimal {
    const amount = new Prisma.Decimal(value);

    if (amount.lte(0)) {
      throw new BadRequestException("Amount must be greater than 0");
    }

    return amount;
  }

  private trimOptional(value: string | undefined): string | undefined {
    const trimmed = value?.trim();

    return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
  }

  private nextNullableString(value: string): string | null {
    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    userId: string,
    eventType: string,
    transferGroupId: string,
    metadata: Prisma.InputJsonValue
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        entityId: transferGroupId,
        entityType: "transfer",
        eventType,
        metadata,
        userId
      }
    });
  }

  private toResponse(pair: TransferPair): TransferResponse {
    if (pair.outflow.transferGroupId === null) {
      throw new BadRequestException("Transfer pair is inconsistent");
    }

    return {
      amount: pair.outflow.amount.toFixed(4),
      currency: pair.outflow.currency,
      fromAccount: {
        id: pair.outflow.account.id,
        name: pair.outflow.account.name
      },
      inflowTransactionId: pair.inflow.id,
      note: pair.outflow.note,
      outflowTransactionId: pair.outflow.id,
      status: pair.outflow.status,
      toAccount: {
        id: pair.inflow.account.id,
        name: pair.inflow.account.name
      },
      transactionAt: pair.outflow.transactionAt.toISOString(),
      transferGroupId: pair.outflow.transferGroupId
    };
  }
}
