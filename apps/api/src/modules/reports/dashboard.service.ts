import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";

export type DashboardCurrencySummary = {
  currency: string;
  monthlyExpense: string;
  monthlyIncome: string;
  netCashflow: string;
  totalBalance: string;
};

export type DashboardBudgetWarning = {
  amount: string;
  budgetId: string;
  category: {
    id: string;
    name: string;
  };
  currency: string;
  isThresholdExceeded: boolean;
  remainingAmount: string;
  spentAmount: string;
  spentPercentage: string;
  thresholdPercentage: string;
};

export type DashboardRecentTransaction = {
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
  status: string;
  transactionAt: string;
  type: "expense" | "income";
};

export type DashboardResponse = {
  budgetSummary: {
    activeBudgetCount: number;
    thresholdExceededCount: number;
    warnings: DashboardBudgetWarning[];
  };
  periodEnd: string;
  periodStart: string;
  recentTransactions: DashboardRecentTransaction[];
  summaryByCurrency: DashboardCurrencySummary[];
};

type MonthlyPeriod = {
  end: Date;
  start: Date;
};

type SummaryAccumulator = {
  monthlyExpense: Prisma.Decimal;
  monthlyIncome: Prisma.Decimal;
  totalBalance: Prisma.Decimal;
};

type BudgetRecord = Prisma.BudgetGetPayload<{
  include: {
    category: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

type BudgetWarningCandidate = DashboardBudgetWarning & {
  spentPercentageDecimal: Prisma.Decimal;
};

type RecentTransactionRecord = Prisma.TransactionGetPayload<{
  select: {
    account: {
      select: {
        id: true;
        name: true;
      };
    };
    amount: true;
    category: {
      select: {
        id: true;
        name: true;
      };
    };
    currency: true;
    id: true;
    merchant: true;
    status: true;
    transactionAt: true;
    type: true;
  };
}>;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(
    userId: string,
    dto: DashboardQueryDto
  ): Promise<DashboardResponse> {
    const period = this.parseMonthlyPeriod(dto.periodStart);
    const recentLimit = dto.recentLimit ?? 5;
    const [
      balanceRows,
      transactionSummaryRows,
      budgetRows,
      recentTransactionRows
    ] = await Promise.all([
      this.prisma.account.findMany({
        select: {
          currency: true,
          currentBalance: true
        },
        where: {
          archivedAt: null,
          deletedAt: null,
          includeInNetWorth: true,
          userId
        }
      }),
      this.prisma.transaction.groupBy({
        _sum: {
          amount: true
        },
        by: ["currency", "type"],
        where: {
          deletedAt: null,
          isDeleted: false,
          transactionAt: {
            gte: period.start,
            lt: period.end
          },
          transferGroupId: null,
          transferSide: null,
          type: {
            in: ["income", "expense"]
          },
          userId
        }
      }),
      this.prisma.budget.findMany({
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
          periodStart: period.start,
          status: "active",
          userId
        }
      }),
      this.prisma.transaction.findMany({
        orderBy: [
          {
            transactionAt: "desc"
          },
          {
            createdAt: "desc"
          }
        ],
        select: this.recentTransactionSelect,
        take: recentLimit,
        where: {
          deletedAt: null,
          isDeleted: false,
          transactionAt: {
            gte: period.start,
            lt: period.end
          },
          transferGroupId: null,
          transferSide: null,
          type: {
            in: ["income", "expense"]
          },
          userId
        }
      })
    ]);

    const summaryByCurrency = new Map<string, SummaryAccumulator>();

    balanceRows.forEach((account) => {
      const summary = this.getSummaryAccumulator(summaryByCurrency, account.currency);

      summary.totalBalance = summary.totalBalance.plus(account.currentBalance);
    });

    transactionSummaryRows.forEach((row) => {
      const amount = row._sum.amount ?? new Prisma.Decimal(0);
      const summary = this.getSummaryAccumulator(summaryByCurrency, row.currency);

      if (row.type === "income") {
        summary.monthlyIncome = summary.monthlyIncome.plus(amount);
      }

      if (row.type === "expense") {
        summary.monthlyExpense = summary.monthlyExpense.plus(amount);
      }
    });

    const budgetWarnings = await this.getBudgetWarnings(budgetRows);

    return {
      budgetSummary: {
        activeBudgetCount: budgetRows.length,
        thresholdExceededCount: budgetWarnings.length,
        warnings: budgetWarnings
      },
      periodEnd: this.toDateOnly(period.end),
      periodStart: this.toDateOnly(period.start),
      recentTransactions: recentTransactionRows.map((transaction) =>
        this.toRecentTransactionResponse(transaction)
      ),
      summaryByCurrency: this.toSummaryResponses(summaryByCurrency)
    };
  }

  private readonly budgetInclude = {
    category: {
      select: {
        id: true,
        name: true
      }
    }
  } satisfies Prisma.BudgetInclude;

  private readonly recentTransactionSelect = {
    account: {
      select: {
        id: true,
        name: true
      }
    },
    amount: true,
    category: {
      select: {
        id: true,
        name: true
      }
    },
    currency: true,
    id: true,
    merchant: true,
    status: true,
    transactionAt: true,
    type: true
  } satisfies Prisma.TransactionSelect;

  private async getBudgetWarnings(
    budgets: BudgetRecord[]
  ): Promise<DashboardBudgetWarning[]> {
    const candidates = await Promise.all(
      budgets.map((budget) => this.toBudgetWarningCandidate(budget))
    );

    return candidates
      .filter((warning) => warning.isThresholdExceeded)
      .sort((left, right) =>
        right.spentPercentageDecimal.comparedTo(left.spentPercentageDecimal)
      )
      .map((warning) => this.toBudgetWarningResponse(warning));
  }

  private async toBudgetWarningCandidate(
    budget: BudgetRecord
  ): Promise<BudgetWarningCandidate> {
    const spentAmount = await this.calculateBudgetSpentAmount(budget);
    const remainingAmount = budget.amount.minus(spentAmount);
    const spentPercentage = spentAmount.div(budget.amount).times(100);

    return {
      amount: budget.amount.toFixed(4),
      budgetId: budget.id,
      category: {
        id: budget.category.id,
        name: budget.category.name
      },
      currency: budget.currency,
      isThresholdExceeded: spentPercentage.gte(budget.thresholdPercentage),
      remainingAmount: remainingAmount.toFixed(4),
      spentAmount: spentAmount.toFixed(4),
      spentPercentage: spentPercentage.toFixed(2),
      spentPercentageDecimal: spentPercentage,
      thresholdPercentage: budget.thresholdPercentage.toFixed(2)
    };
  }

  private async calculateBudgetSpentAmount(
    budget: BudgetRecord
  ): Promise<Prisma.Decimal> {
    const aggregate = await this.prisma.transaction.aggregate({
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

  private toBudgetWarningResponse(
    warning: BudgetWarningCandidate
  ): DashboardBudgetWarning {
    return {
      amount: warning.amount,
      budgetId: warning.budgetId,
      category: warning.category,
      currency: warning.currency,
      isThresholdExceeded: warning.isThresholdExceeded,
      remainingAmount: warning.remainingAmount,
      spentAmount: warning.spentAmount,
      spentPercentage: warning.spentPercentage,
      thresholdPercentage: warning.thresholdPercentage
    };
  }

  private getSummaryAccumulator(
    summaries: Map<string, SummaryAccumulator>,
    currency: string
  ): SummaryAccumulator {
    const existingSummary = summaries.get(currency);

    if (existingSummary !== undefined) {
      return existingSummary;
    }

    const summary = {
      monthlyExpense: new Prisma.Decimal(0),
      monthlyIncome: new Prisma.Decimal(0),
      totalBalance: new Prisma.Decimal(0)
    };

    summaries.set(currency, summary);

    return summary;
  }

  private parseMonthlyPeriod(value: string | undefined): MonthlyPeriod {
    if (value === undefined) {
      const now = new Date();

      return this.toUtcMonthlyPeriod(now.getUTCFullYear(), now.getUTCMonth() + 1);
    }

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

    return this.toUtcMonthlyPeriod(year, month);
  }

  private toUtcMonthlyPeriod(year: number, month: number): MonthlyPeriod {
    return {
      end: new Date(Date.UTC(year, month, 1)),
      start: new Date(Date.UTC(year, month - 1, 1))
    };
  }

  private toRecentTransactionResponse(
    transaction: RecentTransactionRecord
  ): DashboardRecentTransaction {
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
      status: transaction.status,
      transactionAt: transaction.transactionAt.toISOString(),
      type: transaction.type as "expense" | "income"
    };
  }

  private toSummaryResponses(
    summaries: Map<string, SummaryAccumulator>
  ): DashboardCurrencySummary[] {
    return [...summaries.entries()]
      .sort(([leftCurrency], [rightCurrency]) => leftCurrency.localeCompare(rightCurrency))
      .map(([currency, summary]) => ({
        currency,
        monthlyExpense: summary.monthlyExpense.toFixed(4),
        monthlyIncome: summary.monthlyIncome.toFixed(4),
        netCashflow: summary.monthlyIncome.minus(summary.monthlyExpense).toFixed(4),
        totalBalance: summary.totalBalance.toFixed(4)
      }));
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
