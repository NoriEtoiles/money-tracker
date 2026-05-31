"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Account, listAccounts } from "../../lib/api/accounts";
import {
  CashflowReportBucket,
  CashflowReportResponse,
  getCashflowReport,
  getNetWorthReport,
  getSpendingReport,
  NetWorthAccount,
  NetWorthReportResponse,
  SpendingReportItem,
  SpendingReportResponse
} from "../../lib/api/reports";

type ReportsPageProps = {
  accessToken: string;
  currentUser: {
    displayName: string;
    email: string;
  };
  message: string | null;
  navigation: React.ReactNode;
  onLogout: () => void;
};

type ReportTab = "cashflow" | "netWorth" | "spending";

const reportTabs: Array<{ label: string; value: ReportTab }> = [
  { label: "Spending", value: "spending" },
  { label: "Cashflow", value: "cashflow" },
  { label: "Net Worth", value: "netWorth" }
];

const chartColors = ["#0f766e", "#2563eb", "#9333ea", "#d97706", "#dc2626", "#475467"];

export function ReportsPage({
  accessToken,
  currentUser,
  message: sessionMessage,
  navigation,
  onLogout
}: ReportsPageProps): React.ReactElement {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>("spending");
  const [cashflow, setCashflow] = useState<CashflowReportResponse | null>(null);
  const [currency, setCurrency] = useState("");
  const [dateFrom, setDateFrom] = useState(toMonthStart(new Date()));
  const [dateTo, setDateTo] = useState(toMonthEnd(new Date()));
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [netWorth, setNetWorth] = useState<NetWorthReportResponse | null>(null);
  const [spending, setSpending] = useState<SpendingReportResponse | null>(null);

  const currencyOptions = useMemo(() => {
    const currencies = new Set<string>();

    accounts.forEach((account) => currencies.add(account.currency));

    spending?.totalsByCurrency.forEach((total) => currencies.add(total.currency));
    cashflow?.buckets.forEach((bucket) => currencies.add(bucket.currency));
    netWorth?.summaryByCurrency.forEach((summary) => currencies.add(summary.currency));

    return [...currencies].sort();
  }, [accounts, cashflow, netWorth, spending]);

  const loadReports = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setMessage(null);

    try {
      const filters = {
        currency: currency.length > 0 ? currency : undefined,
        dateFrom,
        dateTo
      };
      const [accountResponse, spendingResponse, cashflowResponse, netWorthResponse] =
        await Promise.all([
          listAccounts(accessToken),
          getSpendingReport(accessToken, filters),
          getCashflowReport(accessToken, filters),
          getNetWorthReport(accessToken, {
            currency: filters.currency
          })
        ]);

      setAccounts(accountResponse.items);
      setSpending(spendingResponse);
      setCashflow(cashflowResponse);
      setNetWorth(netWorthResponse);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat laporan.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, currency, dateFrom, dateTo]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Money Tracker</p>
          <h1>Reports</h1>
          <p className="user-line">{currentUser.displayName} / {currentUser.email}</p>
        </div>
        <div className="topbar-actions">
          <span>{currency.length > 0 ? currency : "All currencies"}</span>
          <button className="secondary-inline-button" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      {navigation}

      <section className="report-toolbar" aria-label="Report controls">
        <label className="field">
          <span>From</span>
          <input
            onChange={(event) => setDateFrom(event.target.value)}
            required
            type="date"
            value={dateFrom}
          />
        </label>
        <label className="field">
          <span>To</span>
          <input
            onChange={(event) => setDateTo(event.target.value)}
            required
            type="date"
            value={dateTo}
          />
        </label>
        <label className="field">
          <span>Currency</span>
          <select onChange={(event) => setCurrency(event.target.value)} value={currency}>
            <option value="">All currencies</option>
            {currencyOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary-inline-button"
          disabled={isLoading}
          onClick={() => void loadReports()}
          type="button"
        >
          {isLoading ? "Loading" : "Refresh"}
        </button>
      </section>

      <section className="report-tabs" aria-label="Report sections">
        {reportTabs.map((tab) => (
          <button
            className={activeReportTab === tab.value ? "report-tab report-tab-active" : "report-tab"}
            key={tab.value}
            onClick={() => setActiveReportTab(tab.value)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </section>

      {message !== null ? <p className="status-line">{message}</p> : null}
      {sessionMessage !== null ? <p className="status-line">{sessionMessage}</p> : null}

      <section className="report-view" aria-live="polite">
        {activeReportTab === "spending" && (
          <SpendingPanel isLoading={isLoading} report={spending} />
        )}
        {activeReportTab === "cashflow" && (
          <CashflowPanel isLoading={isLoading} report={cashflow} />
        )}
        {activeReportTab === "netWorth" && (
          <NetWorthPanel isLoading={isLoading} report={netWorth} />
        )}
      </section>
    </main>
  );
}

function SpendingPanel({
  isLoading,
  report
}: {
  isLoading: boolean;
  report: SpendingReportResponse | null;
}): React.ReactElement {
  if (report === null) {
    return <ReportEmpty isLoading={isLoading} title="Spending unavailable" />;
  }

  if (report.items.length === 0) {
    return <ReportEmpty isLoading={isLoading} title="No spending in range" />;
  }

  return (
    <div className="report-section-list">
      {report.totalsByCurrency.map((total) => {
        const items = report.items.filter((item) => item.currency === total.currency);

        return (
          <section className="report-section" key={total.currency}>
            <div className="panel-heading">
              <h2>Spending / {total.currency}</h2>
              <span>{formatMoney(total.totalAmount, total.currency)}</span>
            </div>
            <SpendingStackedChart items={items} />
            <div className="resource-list">
              {items.map((item) => (
                <SpendingRow item={item} key={`${item.currency}:${item.category?.id ?? "none"}`} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SpendingStackedChart({
  items
}: {
  items: SpendingReportItem[];
}): React.ReactElement {
  return (
    <div className="report-stacked-chart" aria-label="Spending share">
      {items.map((item, index) => (
        <div
          className="report-segment"
          key={`${item.currency}:${item.category?.id ?? "none"}`}
          style={{
            background: chartColors[index % chartColors.length],
            width: `${Math.max(Number(item.percentage), 2)}%`
          }}
          title={`${item.category?.name ?? "Uncategorized"} ${item.percentage}%`}
        />
      ))}
    </div>
  );
}

function SpendingRow({ item }: { item: SpendingReportItem }): React.ReactElement {
  return (
    <article className="resource-row report-row">
      <div>
        <h2>{item.category?.name ?? "Uncategorized"}</h2>
        <p>{item.percentage}% / {item.currency}</p>
        <div className="report-bar-track" aria-label={`${item.percentage}%`}>
          <div
            className="report-bar-fill"
            style={{ width: `${Math.max(0, Math.min(Number(item.percentage), 100))}%` }}
          />
        </div>
      </div>
      <div className="balance-block">
        <strong>{formatMoney(item.amount, item.currency)}</strong>
      </div>
    </article>
  );
}

function CashflowPanel({
  isLoading,
  report
}: {
  isLoading: boolean;
  report: CashflowReportResponse | null;
}): React.ReactElement {
  if (report === null) {
    return <ReportEmpty isLoading={isLoading} title="Cashflow unavailable" />;
  }

  if (report.buckets.length === 0) {
    return <ReportEmpty isLoading={isLoading} title="No cashflow in range" />;
  }

  const maxAmount = Math.max(
    ...report.buckets.flatMap((bucket) => [
      Number(bucket.incomeAmount),
      Number(bucket.expenseAmount)
    ]),
    1
  );

  return (
    <section className="report-section">
      <div className="panel-heading">
        <h2>Cashflow</h2>
        <span>{report.dateFrom} / {report.dateTo}</span>
      </div>
      <div className="report-chart-list">
        {report.buckets.map((bucket) => (
          <CashflowBucketRow
            bucket={bucket}
            key={`${bucket.periodStart}:${bucket.currency}`}
            maxAmount={maxAmount}
          />
        ))}
      </div>
    </section>
  );
}

function CashflowBucketRow({
  bucket,
  maxAmount
}: {
  bucket: CashflowReportBucket;
  maxAmount: number;
}): React.ReactElement {
  return (
    <article className="resource-row report-row">
      <div>
        <h2>{formatMonthLabel(bucket.periodStart)} / {bucket.currency}</h2>
        <div className="report-bar-pair">
          <ReportAmountBar
            amount={bucket.incomeAmount}
            className="report-bar-income"
            maxAmount={maxAmount}
          />
          <ReportAmountBar
            amount={bucket.expenseAmount}
            className="report-bar-expense"
            maxAmount={maxAmount}
          />
        </div>
      </div>
      <div className="balance-block report-cashflow-values">
        <strong>{formatMoney(bucket.netCashflow, bucket.currency)}</strong>
        <span className="amount-income">{formatMoney(bucket.incomeAmount, bucket.currency)} in</span>
        <span className="amount-expense">{formatMoney(bucket.expenseAmount, bucket.currency)} out</span>
      </div>
    </article>
  );
}

function ReportAmountBar({
  amount,
  className,
  maxAmount
}: {
  amount: string;
  className: string;
  maxAmount: number;
}): React.ReactElement {
  const width = Math.max(0, Math.min(Number(amount) / maxAmount * 100, 100));

  return (
    <div className="report-bar-track">
      <div className={`report-bar-fill ${className}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function NetWorthPanel({
  isLoading,
  report
}: {
  isLoading: boolean;
  report: NetWorthReportResponse | null;
}): React.ReactElement {
  if (report === null) {
    return <ReportEmpty isLoading={isLoading} title="Net worth unavailable" />;
  }

  if (report.accounts.length === 0) {
    return <ReportEmpty isLoading={isLoading} title="No net worth accounts" />;
  }

  const maxBalance = Math.max(
    ...report.accounts.map((account) => Math.abs(Number(account.currentBalance))),
    1
  );

  return (
    <div className="report-section-list">
      <section className="dashboard-grid" aria-label="Net worth summary">
        {report.summaryByCurrency.map((summary) => (
          <article className="metric" key={summary.currency}>
            <dt>{summary.currency}</dt>
            <dd>{formatMoney(summary.totalBalance, summary.currency)}</dd>
            <p>{summary.accountCount} accounts</p>
          </article>
        ))}
      </section>
      <section className="report-section">
        <div className="panel-heading">
          <h2>Accounts</h2>
          <span>{formatTransactionDate(report.asOf)}</span>
        </div>
        <div className="resource-list">
          {report.accounts.map((account) => (
            <NetWorthAccountRow
              account={account}
              key={account.id}
              maxBalance={maxBalance}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function NetWorthAccountRow({
  account,
  maxBalance
}: {
  account: NetWorthAccount;
  maxBalance: number;
}): React.ReactElement {
  const width = Math.max(0, Math.min(Math.abs(Number(account.currentBalance)) / maxBalance * 100, 100));

  return (
    <article className="resource-row report-row">
      <div>
        <h2>{account.name}</h2>
        <p>{account.type} / {account.currency}</p>
        <div className="report-bar-track" aria-label={account.currentBalance}>
          <div className="report-bar-fill" style={{ width: `${width}%` }} />
        </div>
      </div>
      <div className="balance-block">
        <strong>{formatMoney(account.currentBalance, account.currency)}</strong>
      </div>
    </article>
  );
}

function ReportEmpty({
  isLoading,
  title
}: {
  isLoading: boolean;
  title: string;
}): React.ReactElement {
  return (
    <div className="empty-state">
      <h2>{isLoading ? "Loading reports" : title}</h2>
      <p>Report data will appear after matching transactions or accounts are available.</p>
    </div>
  );
}

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat("id-ID", {
    currency,
    style: "currency"
  }).format(Number(amount));
}

function formatMonthLabel(periodStart: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric"
  }).format(new Date(`${periodStart}T00:00:00.000Z`));
}

function formatTransactionDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function toMonthEnd(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

function toMonthStart(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}
