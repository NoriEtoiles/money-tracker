import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NetWorthQueryDto } from "./dto/net-worth-query.dto";
import { ReportDateRangeQueryDto } from "./dto/report-date-range-query.dto";

export type SpendingReportItem = {
  amount: string;
  category: {
    id: string;
    name: string;
  } | null;
  currency: string;
  percentage: string;
};

export type SpendingReportResponse = {
  dateFrom: string;
  dateTo: string;
  items: SpendingReportItem[];
  totalsByCurrency: Array<{
    currency: string;
    totalAmount: string;
  }>;
};

export type CashflowReportBucket = {
  currency: string;
  expenseAmount: string;
  incomeAmount: string;
  netCashflow: string;
  periodEnd: string;
  periodStart: string;
};

export type CashflowReportResponse = {
  buckets: CashflowReportBucket[];
  dateFrom: string;
  dateTo: string;
  grain: "month";
};

export type NetWorthAccount = {
  currentBalance: string;
  currency: string;
  id: string;
  name: string;
  sortOrder: number;
  type: string;
};

export type NetWorthReportResponse = {
  accounts: NetWorthAccount[];
  asOf: string;
  summaryByCurrency: Array<{
    accountCount: number;
    currency: string;
    totalBalance: string;
  }>;
};

type DateRange = {
  dateFrom: string;
  dateTo: string;
  endExclusive: Date;
  start: Date;
};

type SpendingAccumulator = {
  amount: Prisma.Decimal;
  category: {
    id: string;
    name: string;
  } | null;
  currency: string;
};

type CashflowAccumulator = {
  currency: string;
  expenseAmount: Prisma.Decimal;
  incomeAmount: Prisma.Decimal;
  periodEnd: Date;
  periodStart: Date;
};

type NetWorthSummaryAccumulator = {
  accountCount: number;
  totalBalance: Prisma.Decimal;
};

type NetWorthAccountRecord = Prisma.AccountGetPayload<{
  select: {
    createdAt: true;
    currentBalance: true;
    currency: true;
    id: true;
    name: true;
    sortOrder: true;
    type: true;
  };
}>;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSpendingReport(
    userId: string,
    dto: ReportDateRangeQueryDto
  ): Promise<SpendingReportResponse> {
    const range = this.parseDateRange(dto);
    const rows = await this.prisma.transaction.findMany({
      select: this.spendingTransactionSelect,
      where: {
        currency: dto.currency,
        deletedAt: null,
        isDeleted: false,
        transactionAt: {
          gte: range.start,
          lt: range.endExclusive
        },
        transferGroupId: null,
        transferSide: null,
        type: "expense",
        userId
      }
    });
    const itemsByCategory = new Map<string, SpendingAccumulator>();
    const totalsByCurrency = new Map<string, Prisma.Decimal>();

    rows.forEach((row) => {
      const key = `${row.currency}:${row.category?.id ?? "uncategorized"}`;
      const existingItem = itemsByCategory.get(key) ?? {
        amount: new Prisma.Decimal(0),
        category: row.category,
        currency: row.currency
      };

      existingItem.amount = existingItem.amount.plus(row.amount);
      itemsByCategory.set(key, existingItem);
      totalsByCurrency.set(
        row.currency,
        (totalsByCurrency.get(row.currency) ?? new Prisma.Decimal(0)).plus(row.amount)
      );
    });

    return {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      items: this.toSpendingItems(itemsByCategory, totalsByCurrency),
      totalsByCurrency: this.toCurrencyTotals(totalsByCurrency)
    };
  }

  async getCashflowReport(
    userId: string,
    dto: ReportDateRangeQueryDto
  ): Promise<CashflowReportResponse> {
    const range = this.parseDateRange(dto);
    const rows = await this.prisma.transaction.findMany({
      select: this.cashflowTransactionSelect,
      where: {
        currency: dto.currency,
        deletedAt: null,
        isDeleted: false,
        transactionAt: {
          gte: range.start,
          lt: range.endExclusive
        },
        transferGroupId: null,
        transferSide: null,
        type: {
          in: ["income", "expense"]
        },
        userId
      }
    });
    const bucketsByMonth = new Map<string, CashflowAccumulator>();

    rows.forEach((row) => {
      const period = this.toUtcMonthPeriod(row.transactionAt);
      const key = `${this.toDateOnly(period.start)}:${row.currency}`;
      const bucket = bucketsByMonth.get(key) ?? {
        currency: row.currency,
        expenseAmount: new Prisma.Decimal(0),
        incomeAmount: new Prisma.Decimal(0),
        periodEnd: period.end,
        periodStart: period.start
      };

      if (row.type === "income") {
        bucket.incomeAmount = bucket.incomeAmount.plus(row.amount);
      }

      if (row.type === "expense") {
        bucket.expenseAmount = bucket.expenseAmount.plus(row.amount);
      }

      bucketsByMonth.set(key, bucket);
    });

    return {
      buckets: this.toCashflowBuckets(bucketsByMonth),
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      grain: "month"
    };
  }

  async getNetWorthReport(
    userId: string,
    dto: NetWorthQueryDto
  ): Promise<NetWorthReportResponse> {
    const accounts = await this.prisma.account.findMany({
      select: this.netWorthAccountSelect,
      where: {
        archivedAt: null,
        currency: dto.currency,
        deletedAt: null,
        includeInNetWorth: true,
        userId
      }
    });
    const sortedAccounts = [...accounts].sort((left, right) =>
      this.compareNetWorthAccounts(left, right)
    );
    const summaryByCurrency = new Map<string, NetWorthSummaryAccumulator>();

    sortedAccounts.forEach((account) => {
      const summary = summaryByCurrency.get(account.currency) ?? {
        accountCount: 0,
        totalBalance: new Prisma.Decimal(0)
      };

      summary.accountCount += 1;
      summary.totalBalance = summary.totalBalance.plus(account.currentBalance);
      summaryByCurrency.set(account.currency, summary);
    });

    return {
      accounts: sortedAccounts.map((account) => ({
        currentBalance: account.currentBalance.toFixed(4),
        currency: account.currency,
        id: account.id,
        name: account.name,
        sortOrder: account.sortOrder,
        type: account.type
      })),
      asOf: new Date().toISOString(),
      summaryByCurrency: [...summaryByCurrency.entries()]
        .sort(([leftCurrency], [rightCurrency]) => leftCurrency.localeCompare(rightCurrency))
        .map(([currency, summary]) => ({
          accountCount: summary.accountCount,
          currency,
          totalBalance: summary.totalBalance.toFixed(4)
        }))
    };
  }

  private readonly spendingTransactionSelect = {
    amount: true,
    category: {
      select: {
        id: true,
        name: true
      }
    },
    currency: true
  } satisfies Prisma.TransactionSelect;

  private readonly cashflowTransactionSelect = {
    amount: true,
    currency: true,
    transactionAt: true,
    type: true
  } satisfies Prisma.TransactionSelect;

  private readonly netWorthAccountSelect = {
    createdAt: true,
    currentBalance: true,
    currency: true,
    id: true,
    name: true,
    sortOrder: true,
    type: true
  } satisfies Prisma.AccountSelect;

  private compareNetWorthAccounts(
    left: NetWorthAccountRecord,
    right: NetWorthAccountRecord
  ): number {
    const currencyDifference = left.currency.localeCompare(right.currency);

    if (currencyDifference !== 0) {
      return currencyDifference;
    }

    const sortOrderDifference = left.sortOrder - right.sortOrder;

    if (sortOrderDifference !== 0) {
      return sortOrderDifference;
    }

    const nameDifference = left.name.localeCompare(right.name);

    if (nameDifference !== 0) {
      return nameDifference;
    }

    const createdAtDifference = left.createdAt.getTime() - right.createdAt.getTime();

    return createdAtDifference !== 0
      ? createdAtDifference
      : left.id.localeCompare(right.id);
  }

  private parseDateRange(dto: ReportDateRangeQueryDto): DateRange {
    const start = this.parseDateOnly(dto.dateFrom, "dateFrom");
    const dateTo = this.parseDateOnly(dto.dateTo, "dateTo");
    const endExclusive = this.nextUtcDay(dateTo);

    if (start.getTime() >= endExclusive.getTime()) {
      throw new BadRequestException("dateFrom must be before or equal to dateTo");
    }

    return {
      dateFrom: this.toDateOnly(start),
      dateTo: this.toDateOnly(dateTo),
      endExclusive,
      start
    };
  }

  private parseDateOnly(value: string, fieldName: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (match === null) {
      throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${fieldName} must be a valid calendar date`);
    }

    return date;
  }

  private nextUtcDay(date: Date): Date {
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + 1
    ));
  }

  private toCashflowBuckets(
    bucketsByMonth: Map<string, CashflowAccumulator>
  ): CashflowReportBucket[] {
    return [...bucketsByMonth.values()]
      .sort((left, right) => {
        const periodDifference = left.periodStart.getTime() - right.periodStart.getTime();

        return periodDifference !== 0
          ? periodDifference
          : left.currency.localeCompare(right.currency);
      })
      .map((bucket) => ({
        currency: bucket.currency,
        expenseAmount: bucket.expenseAmount.toFixed(4),
        incomeAmount: bucket.incomeAmount.toFixed(4),
        netCashflow: bucket.incomeAmount.minus(bucket.expenseAmount).toFixed(4),
        periodEnd: this.toDateOnly(bucket.periodEnd),
        periodStart: this.toDateOnly(bucket.periodStart)
      }));
  }

  private toCurrencyTotals(
    totalsByCurrency: Map<string, Prisma.Decimal>
  ): Array<{ currency: string; totalAmount: string }> {
    return [...totalsByCurrency.entries()]
      .sort(([leftCurrency], [rightCurrency]) => leftCurrency.localeCompare(rightCurrency))
      .map(([currency, totalAmount]) => ({
        currency,
        totalAmount: totalAmount.toFixed(4)
      }));
  }

  private toSpendingItems(
    itemsByCategory: Map<string, SpendingAccumulator>,
    totalsByCurrency: Map<string, Prisma.Decimal>
  ): SpendingReportItem[] {
    return [...itemsByCategory.values()]
      .sort((left, right) => {
        const currencyDifference = left.currency.localeCompare(right.currency);

        if (currencyDifference !== 0) {
          return currencyDifference;
        }

        const amountDifference = right.amount.comparedTo(left.amount);

        if (amountDifference !== 0) {
          return amountDifference;
        }

        const nameDifference = this.getCategoryName(left).localeCompare(
          this.getCategoryName(right)
        );

        return nameDifference !== 0
          ? nameDifference
          : (left.category?.id ?? "").localeCompare(right.category?.id ?? "");
      })
      .map((item) => {
        const total = totalsByCurrency.get(item.currency) ?? new Prisma.Decimal(0);
        const percentage = total.gt(0)
          ? item.amount.div(total).times(100)
          : new Prisma.Decimal(0);

        return {
          amount: item.amount.toFixed(4),
          category: item.category,
          currency: item.currency,
          percentage: percentage.toFixed(2)
        };
      });
  }

  private getCategoryName(item: SpendingAccumulator): string {
    return item.category?.name ?? "Uncategorized";
  }

  private toUtcMonthPeriod(date: Date): { end: Date; start: Date } {
    return {
      end: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)),
      start: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    };
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
