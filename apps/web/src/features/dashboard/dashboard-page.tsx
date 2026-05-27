"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DashboardBudgetWarning,
  DashboardRecentTransaction,
  DashboardResponse,
  getDashboard
} from "../../lib/api/dashboard";

type DashboardPageProps = {
  accessToken: string;
  currentUser: {
    displayName: string;
    email: string;
  };
  message: string | null;
  navigation: React.ReactNode;
  onLogout: () => void;
};

export function DashboardPage({
  accessToken,
  currentUser,
  message: sessionMessage,
  navigation,
  onLogout
}: DashboardPageProps): React.ReactElement {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(toMonthValue(new Date()));

  const loadDashboard = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await getDashboard(accessToken, {
        periodStart: monthToPeriodStart(selectedMonth),
        recentLimit: 5
      });

      setDashboard(response);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedMonth]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Money Tracker</p>
          <h1>Dashboard</h1>
          <p className="user-line">{currentUser.displayName} / {currentUser.email}</p>
        </div>
        <div className="topbar-actions">
          <span>{dashboard === null ? "Ready" : formatMonthLabel(dashboard.periodStart)}</span>
          <button className="secondary-inline-button" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      {navigation}

      <section className="dashboard-toolbar" aria-label="Dashboard controls">
        <label className="field dashboard-month-field">
          <span>Month</span>
          <input
            onChange={(event) => setSelectedMonth(event.target.value)}
            type="month"
            value={selectedMonth}
          />
        </label>
        <button
          className="secondary-inline-button"
          disabled={isLoading}
          onClick={() => void loadDashboard()}
          type="button"
        >
          {isLoading ? "Loading" : "Refresh"}
        </button>
      </section>

      {message !== null ? <p className="status-line">{message}</p> : null}
      {sessionMessage !== null ? <p className="status-line">{sessionMessage}</p> : null}

      {dashboard === null ? (
        <div className="empty-state dashboard-empty">
          <h2>{isLoading ? "Loading dashboard" : "Dashboard unavailable"}</h2>
          <p>Summary will appear after the dashboard data loads.</p>
        </div>
      ) : (
        <>
          <section className="dashboard-grid" aria-label="Financial summary">
            {dashboard.summaryByCurrency.length === 0 ? (
              <div className="empty-state">
                <h2>No summary yet</h2>
                <p>Add accounts and transactions to see your monthly overview.</p>
              </div>
            ) : (
              dashboard.summaryByCurrency.map((summary) => (
                <article className="metric dashboard-summary-card" key={summary.currency}>
                  <div className="panel-heading">
                    <h2>{summary.currency}</h2>
                  </div>
                  <dl className="dashboard-metric-list">
                    <div>
                      <dt>Total balance</dt>
                      <dd>{formatMoney(summary.totalBalance, summary.currency)}</dd>
                    </div>
                    <div>
                      <dt>Monthly income</dt>
                      <dd className="amount-income">
                        {formatMoney(summary.monthlyIncome, summary.currency)}
                      </dd>
                    </div>
                    <div>
                      <dt>Monthly expense</dt>
                      <dd className="amount-expense">
                        {formatMoney(summary.monthlyExpense, summary.currency)}
                      </dd>
                    </div>
                    <div>
                      <dt>Net cashflow</dt>
                      <dd>{formatMoney(summary.netCashflow, summary.currency)}</dd>
                    </div>
                  </dl>
                </article>
              ))
            )}
          </section>

          <section className="dashboard-layout" aria-label="Dashboard detail">
            <section className="dashboard-section" aria-label="Budget warnings">
              <div className="panel-heading">
                <h2>Budget Warnings</h2>
                <span>
                  {dashboard.budgetSummary.thresholdExceededCount} / {dashboard.budgetSummary.activeBudgetCount}
                </span>
              </div>

              {dashboard.budgetSummary.warnings.length === 0 ? (
                <div className="empty-state dashboard-inline-empty">
                  <h2>No budget warnings</h2>
                  <p>Active budgets are still below their warning thresholds.</p>
                </div>
              ) : (
                <div className="resource-list">
                  {dashboard.budgetSummary.warnings.map((warning) => (
                    <BudgetWarningRow key={warning.budgetId} warning={warning} />
                  ))}
                </div>
              )}
            </section>

            <section className="dashboard-section" aria-label="Recent transactions">
              <div className="panel-heading">
                <h2>Recent Transactions</h2>
                <span>{dashboard.recentTransactions.length} shown</span>
              </div>

              {dashboard.recentTransactions.length === 0 ? (
                <div className="empty-state dashboard-inline-empty">
                  <h2>No transactions yet</h2>
                  <p>Add income or expenses to see recent ledger activity.</p>
                </div>
              ) : (
                <div className="resource-list">
                  {dashboard.recentTransactions.map((transaction) => (
                    <RecentTransactionRow
                      key={transaction.id}
                      transaction={transaction}
                    />
                  ))}
                </div>
              )}
            </section>
          </section>
        </>
      )}
    </main>
  );
}

function BudgetWarningRow({
  warning
}: {
  warning: DashboardBudgetWarning;
}): React.ReactElement {
  const percentage = Math.max(0, Math.min(Number(warning.spentPercentage), 100));

  return (
    <article className="resource-row dashboard-warning-row">
      <div>
        <h2>{warning.category.name}</h2>
        <p>{warning.currency} / threshold {warning.thresholdPercentage}%</p>
        <div className="budget-progress" aria-label={`${warning.spentPercentage}% spent`}>
          <div className="budget-progress-bar">
            <div
              className="budget-progress-fill budget-progress-warning"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span>{warning.spentPercentage}% spent</span>
        </div>
      </div>
      <div className="balance-block">
        <strong>
          {formatMoney(warning.spentAmount, warning.currency)} / {formatMoney(warning.amount, warning.currency)}
        </strong>
        <span className="budget-warning">
          {formatMoney(warning.remainingAmount, warning.currency)} left
        </span>
      </div>
    </article>
  );
}

function RecentTransactionRow({
  transaction
}: {
  transaction: DashboardRecentTransaction;
}): React.ReactElement {
  return (
    <article className="resource-row transaction-row">
      <div>
        <h2>{transaction.category?.name ?? formatType(transaction.type)}</h2>
        <p>{transaction.merchant ?? "No merchant"} / {transaction.account.name}</p>
      </div>
      <div className="balance-block">
        <strong className={transaction.type === "income" ? "amount-income" : "amount-expense"}>
          {transaction.type === "income" ? "+" : "-"}
          {formatMoney(transaction.amount, transaction.currency)}
        </strong>
        <span>{formatTransactionDate(transaction.transactionAt)}</span>
      </div>
    </article>
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
    month: "long",
    year: "numeric"
  }).format(new Date(`${periodStart}T00:00:00.000Z`));
}

function formatTransactionDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatType(type: DashboardRecentTransaction["type"]): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function monthToPeriodStart(month: string): string {
  return `${month}-01`;
}

function toMonthValue(date: Date): string {
  return date.toISOString().slice(0, 7);
}
