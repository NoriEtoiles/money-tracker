"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Account, listAccounts } from "../../lib/api/accounts";
import {
  createCsvExport,
  CsvExportItem,
  downloadCsvExportBlob,
  ExportTransactionType,
  listCsvExports
} from "../../lib/api/exports";

type ExportsPageProps = {
  accessToken: string;
  currentUser: {
    displayName: string;
    email: string;
  };
  message: string | null;
  navigation: React.ReactNode;
  onLogout: () => void;
};

type ExportFilterForm = {
  accountId: string;
  currency: string;
  dateFrom: string;
  dateTo: string;
  transactionType: "" | ExportTransactionType;
};

const initialFilters = (): ExportFilterForm => ({
  accountId: "",
  currency: "",
  dateFrom: toMonthStart(new Date()),
  dateTo: toMonthEnd(new Date()),
  transactionType: ""
});

export function ExportsPage({
  accessToken,
  currentUser,
  message: sessionMessage,
  navigation,
  onLogout
}: ExportsPageProps): React.ReactElement {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filters, setFilters] = useState<ExportFilterForm>(initialFilters);
  const [history, setHistory] = useState<CsvExportItem[]>([]);
  const [isDownloadingId, setIsDownloadingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currencyOptions = useMemo(() => {
    const currencies = new Set<string>();

    accounts.forEach((account) => currencies.add(account.currency));
    history.forEach((item) => {
      if (item.filters.currency !== undefined) {
        currencies.add(item.filters.currency);
      }
    });

    return [...currencies].sort();
  }, [accounts, history]);

  const loadWorkspace = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setMessage(null);

    try {
      const [accountResponse, exportResponse] = await Promise.all([
        listAccounts(accessToken),
        listCsvExports(accessToken)
      ]);

      setAccounts(accountResponse.items);
      setHistory(exportResponse.items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat workspace export.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const created = await createCsvExport(accessToken, {
        accountId: filters.accountId || undefined,
        currency: filters.currency || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        exportType: "transactions_csv",
        transactionType: filters.transactionType || undefined
      });

      await loadHistory();
      setMessage(`Export siap di-download: ${created.filename}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuat export.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownload(item: CsvExportItem): Promise<void> {
    if (item.downloadUrl === null) {
      setMessage("Export sudah expired. Buat export baru untuk download CSV.");
      return;
    }

    setIsDownloadingId(item.exportId);
    setMessage(null);

    try {
      const download = await downloadCsvExportBlob(accessToken, item.downloadUrl, item.filename);

      saveBlob(download.blob, download.filename);
      await loadHistory();
      setMessage(`Downloaded ${download.filename}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal download export.");
    } finally {
      setIsDownloadingId(null);
    }
  }

  async function loadHistory(): Promise<void> {
    const response = await listCsvExports(accessToken);

    setHistory(response.items);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Money Tracker</p>
          <h1>Export CSV</h1>
          <p className="user-line">{currentUser.displayName} / {currentUser.email}</p>
        </div>
        <div className="topbar-actions">
          <span>{history.length} exports</span>
          <button className="secondary-inline-button" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      {navigation}

      <section className="import-layout">
        <section className="tool-panel">
          <div className="panel-heading">
            <h2>Request Export</h2>
            <button className="secondary-button" disabled={isLoading} onClick={() => void loadWorkspace()} type="button">
              {isLoading ? "Loading" : "Refresh"}
            </button>
          </div>
          <p className="helper-line">
            CSV is generated on download from the selected filters. Amounts stay in their original currency.
          </p>
          <form className="resource-edit-form" onSubmit={(event) => void handleCreate(event)}>
            <label className="field">
              <span>From</span>
              <input
                onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
                type="date"
                value={filters.dateFrom}
              />
            </label>
            <label className="field">
              <span>To</span>
              <input
                onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
                type="date"
                value={filters.dateTo}
              />
            </label>
            <label className="field">
              <span>Account</span>
              <select
                onChange={(event) => setFilters({ ...filters, accountId: event.target.value })}
                value={filters.accountId}
              >
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} / {account.currency}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Currency</span>
              <select
                onChange={(event) => setFilters({ ...filters, currency: event.target.value })}
                value={filters.currency}
              >
                <option value="">All currencies</option>
                {currencyOptions.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Transaction type</span>
              <select
                onChange={(event) => setFilters({
                  ...filters,
                  transactionType: event.target.value as ExportFilterForm["transactionType"]
                })}
                value={filters.transactionType}
              >
                <option value="">All ledger rows</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="transfer">Transfer</option>
              </select>
            </label>
            <button className="primary-button" disabled={isSaving} type="submit">
              {isSaving ? "Creating" : "Create Export"}
            </button>
          </form>
          {message !== null ? <p className="status-line">{message}</p> : null}
          {sessionMessage !== null ? <p className="status-line">{sessionMessage}</p> : null}
        </section>

        <section className="tool-panel">
          <div className="panel-heading">
            <h2>Included Data</h2>
            <span>Transactions CSV</span>
          </div>
          <p className="helper-line">
            Includes non-deleted income, expense, and transfer ledger rows. Transfer rows include group and side fields.
          </p>
          <div className="empty-state">
            <p>Export excludes deleted rows, deleted accounts, auth data, audit logs, tokens, and secrets.</p>
          </div>
        </section>
      </section>

      <section className="tool-panel import-history-panel">
        <div className="panel-heading">
          <h2>Recent Export History</h2>
          <span>Signed links expire quickly</span>
        </div>
        {history.length === 0 ? (
          <div className="empty-state">
            <p>No CSV exports yet.</p>
          </div>
        ) : (
          <div className="import-row-list">
            {history.map((item) => (
              <article className="import-row" key={item.exportId}>
                <div>
                  <strong>{item.filename}</strong>
                  <p>{formatFilters(item.filters)}</p>
                  <p>{formatDate(item.createdAt)} / expires {formatDate(item.expiresAt)}</p>
                </div>
                <div className="balance-block">
                  <strong>{item.status}</strong>
                  <span>{item.rowCount === null ? "Generated on download" : `${item.rowCount} rows`}</span>
                  <button
                    className="primary-button"
                    disabled={item.downloadUrl === null || isDownloadingId === item.exportId}
                    onClick={() => void handleDownload(item)}
                    type="button"
                  >
                    {isDownloadingId === item.exportId ? "Downloading" : "Download CSV"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function formatFilters(filters: CsvExportItem["filters"]): string {
  const parts = [
    filters.dateFrom === undefined ? null : `from ${filters.dateFrom}`,
    filters.dateTo === undefined ? null : `to ${filters.dateTo}`,
    filters.accountId === undefined ? null : `account ${filters.accountId.slice(0, 8)}`,
    filters.currency,
    filters.transactionType
  ].filter((part): part is string => part !== null && part !== undefined && part.length > 0);

  return parts.length === 0 ? "All non-deleted ledger rows" : parts.join(" / ");
}

function saveBlob(blob: Blob, filename: string): void {
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("id-ID");
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
