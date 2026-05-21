import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Budget, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateBudgetDto } from "./dto/create-budget.dto";
import { ListBudgetsDto } from "./dto/list-budgets.dto";
import { UpdateBudgetDto } from "./dto/update-budget.dto";

export type BudgetResponse = {
  amount: string;
  category: {
    id: string;
    name: string;
  };
  currency: string;
  id: string;
  isThresholdExceeded: boolean;
  periodEnd: string;
  periodStart: string;
  remainingAmount: string;
  spentAmount: string;
  spentPercentage: string;
  status: string;
  thresholdPercentage: string;
};

export type BudgetListResponse = {
  items: BudgetResponse[];
};

export type BudgetDeleteResponse = {
  mode: "archived";
  success: true;
};

type BudgetRecord = Budget & {
  category: {
    id: string;
    name: string;
  };
};

type BudgetIdentity = {
  categoryId: string;
  currency: string;
  periodStart: Date;
  userId: string;
};

type MonthlyPeriod = {
  end: Date;
  start: Date;
};

@Injectable()
export class BudgetsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listBudgets(userId: string, dto: ListBudgetsDto): Promise<BudgetListResponse> {
    const period = this.parseMonthlyPeriod(dto.periodStart);
    const budgets = await this.prisma.budget.findMany({
      include: this.budgetInclude,
      orderBy: [
        {
          category: {
            name: "asc"
          }
        },
        {
          createdAt: "asc"
        }
      ],
      where: {
        currency: dto.currency,
        periodStart: period.start,
        status: "active",
        userId
      }
    });

    return {
      items: await Promise.all(
        budgets.map((budget) => this.toResponse(this.prisma, budget))
      )
    };
  }

  async createBudget(userId: string, dto: CreateBudgetDto): Promise<BudgetResponse> {
    const amount = this.parsePositiveAmount(dto.amount);
    const period = this.parseMonthlyPeriod(dto.periodStart);
    const thresholdPercentage = this.parseThresholdPercentage(dto.thresholdPercentage);

    const result = await this.runWithBudgetConflictMapping(async () =>
      this.prisma.$transaction(async (tx) => {
        const category = await this.assertExpenseCategory(tx, userId, dto.categoryId);
        const identity = {
          categoryId: category.id,
          currency: dto.currency,
          periodStart: period.start,
          userId
        };
        const existingBudget = await this.findBudgetByIdentity(tx, identity);

        if (existingBudget !== null && existingBudget.status === "active") {
          throw new ConflictException("Budget already exists for category, month, and currency");
        }

        if (existingBudget !== null) {
          const budget = await tx.budget.update({
            data: {
              amount,
              periodEnd: period.end,
              status: "active",
              thresholdPercentage
            },
            include: this.budgetInclude,
            where: {
              id: existingBudget.id
            }
          });

          return {
            budget,
            eventType: "budget_reactivate"
          };
        }

        const budget = await tx.budget.create({
          data: {
            amount,
            categoryId: category.id,
            currency: dto.currency,
            periodEnd: period.end,
            periodStart: period.start,
            thresholdPercentage,
            userId
          },
          include: this.budgetInclude
        });

        return {
          budget,
          eventType: "budget_create"
        };
      })
    );

    await this.auditService.record({
      entityId: result.budget.id,
      entityType: "budget",
      eventType: result.eventType,
      userId
    });

    return this.toResponse(this.prisma, result.budget);
  }

  async updateBudget(
    userId: string,
    budgetId: string,
    dto: UpdateBudgetDto
  ): Promise<BudgetResponse> {
    const result = await this.runWithBudgetConflictMapping(async () =>
      this.prisma.$transaction(async (tx) => {
        const existingBudget = await this.assertActiveBudget(tx, userId, budgetId);
        const nextCategoryId = dto.categoryId ?? existingBudget.categoryId;
        const nextCategory = await this.assertExpenseCategory(tx, userId, nextCategoryId);
        const nextCurrency = dto.currency ?? existingBudget.currency;
        const nextPeriod = dto.periodStart !== undefined
          ? this.parseMonthlyPeriod(dto.periodStart)
          : {
              end: existingBudget.periodEnd,
              start: existingBudget.periodStart
            };
        const nextAmount = dto.amount !== undefined
          ? this.parsePositiveAmount(dto.amount)
          : existingBudget.amount;
        const nextThresholdPercentage = dto.thresholdPercentage !== undefined
          ? this.parseThresholdPercentage(dto.thresholdPercentage)
          : existingBudget.thresholdPercentage;
        const collision = await this.findBudgetByIdentity(tx, {
          categoryId: nextCategory.id,
          currency: nextCurrency,
          periodStart: nextPeriod.start,
          userId
        });

        if (collision !== null && collision.id !== budgetId) {
          throw new ConflictException("Budget already exists for category, month, and currency");
        }

        return tx.budget.update({
          data: {
            amount: nextAmount,
            categoryId: nextCategory.id,
            currency: nextCurrency,
            periodEnd: nextPeriod.end,
            periodStart: nextPeriod.start,
            thresholdPercentage: nextThresholdPercentage
          },
          include: this.budgetInclude,
          where: {
            id: budgetId
          }
        });
      })
    );

    await this.auditService.record({
      entityId: result.id,
      entityType: "budget",
      eventType: "budget_update",
      userId
    });

    return this.toResponse(this.prisma, result);
  }

  async archiveBudget(userId: string, budgetId: string): Promise<BudgetDeleteResponse> {
    const budget = await this.prisma.$transaction(async (tx) => {
      const existingBudget = await this.assertActiveBudget(tx, userId, budgetId);

      return tx.budget.update({
        data: {
          status: "archived"
        },
        where: {
          id: existingBudget.id
        }
      });
    });

    await this.auditService.record({
      entityId: budget.id,
      entityType: "budget",
      eventType: "budget_archive",
      userId
    });

    return {
      mode: "archived",
      success: true
    };
  }

  private readonly budgetInclude = {
    category: {
      select: {
        id: true,
        name: true
      }
    }
  } as const;

  private async assertActiveBudget(
    tx: Prisma.TransactionClient,
    userId: string,
    budgetId: string
  ): Promise<BudgetRecord> {
    const budget = await tx.budget.findFirst({
      include: this.budgetInclude,
      where: {
        id: budgetId,
        status: "active",
        userId
      }
    });

    if (budget === null) {
      throw new NotFoundException("Budget not found");
    }

    return budget;
  }

  private async assertExpenseCategory(
    tx: Prisma.TransactionClient,
    userId: string,
    categoryId: string
  ): Promise<{ id: string; kind: string; name: string }> {
    const category = await tx.category.findFirst({
      select: {
        archivedAt: true,
        deletedAt: true,
        id: true,
        kind: true,
        name: true
      },
      where: {
        id: categoryId,
        userId
      }
    });

    if (category === null || category.archivedAt !== null || category.deletedAt !== null) {
      throw new NotFoundException("Category not found");
    }

    if (category.kind !== "expense") {
      throw new BadRequestException("Budget category must be an expense category");
    }

    return category;
  }

  private async findBudgetByIdentity(
    tx: Prisma.TransactionClient,
    identity: BudgetIdentity
  ): Promise<{ id: string; status: string } | null> {
    return tx.budget.findUnique({
      select: {
        id: true,
        status: true
      },
      where: {
        userId_categoryId_periodStart_currency: identity
      }
    });
  }

  private async calculateSpentAmount(
    client: PrismaService | Prisma.TransactionClient,
    budget: {
      categoryId: string;
      currency: string;
      periodEnd: Date;
      periodStart: Date;
      userId: string;
    }
  ): Promise<Prisma.Decimal> {
    const aggregate = await client.transaction.aggregate({
      _sum: {
        amount: true
      },
      where: {
        categoryId: budget.categoryId,
        currency: budget.currency,
        deletedAt: null,
        isDeleted: false,
        transactionAt: {
          gte: budget.periodStart,
          lt: budget.periodEnd
        },
        transferGroupId: null,
        transferSide: null,
        type: "expense",
        userId: budget.userId
      }
    });

    return aggregate._sum.amount ?? new Prisma.Decimal(0);
  }

  private parseMonthlyPeriod(value: string): MonthlyPeriod {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (match === null) {
      throw new BadRequestException("periodStart must use YYYY-MM-DD format");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (month < 1 || month > 12 || day !== 1) {
      throw new BadRequestException("periodStart must be the first day of a month");
    }

    return {
      end: new Date(Date.UTC(year, month, 1)),
      start: new Date(Date.UTC(year, month - 1, 1))
    };
  }

  private parsePositiveAmount(value: string): Prisma.Decimal {
    const amount = this.parseDecimal(value, "Amount must be a valid decimal");

    if (amount.lte(0)) {
      throw new BadRequestException("Amount must be greater than 0");
    }

    return amount;
  }

  private parseThresholdPercentage(value: number | undefined): Prisma.Decimal {
    const thresholdPercentage = this.parseDecimal(
      String(value ?? 80),
      "Threshold percentage must be a valid decimal"
    );

    if (thresholdPercentage.lt(1) || thresholdPercentage.gt(100)) {
      throw new BadRequestException("Threshold percentage must be between 1 and 100");
    }

    return thresholdPercentage;
  }

  private parseDecimal(value: string, message: string): Prisma.Decimal {
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException(message);
    }
  }

  private async runWithBudgetConflictMapping<T>(callback: () => Promise<T>): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Budget already exists for category, month, and currency");
      }

      throw error;
    }
  }

  private async toResponse(
    client: PrismaService | Prisma.TransactionClient,
    budget: BudgetRecord
  ): Promise<BudgetResponse> {
    const spentAmount = await this.calculateSpentAmount(client, budget);
    const remainingAmount = budget.amount.minus(spentAmount);
    const spentPercentage = spentAmount.div(budget.amount).times(100);

    return {
      amount: budget.amount.toFixed(4),
      category: {
        id: budget.category.id,
        name: budget.category.name
      },
      currency: budget.currency,
      id: budget.id,
      isThresholdExceeded: spentPercentage.gte(budget.thresholdPercentage),
      periodEnd: this.toDateOnly(budget.periodEnd),
      periodStart: this.toDateOnly(budget.periodStart),
      remainingAmount: remainingAmount.toFixed(4),
      spentAmount: spentAmount.toFixed(4),
      spentPercentage: spentPercentage.toFixed(2),
      status: budget.status,
      thresholdPercentage: budget.thresholdPercentage.toFixed(2)
    };
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
