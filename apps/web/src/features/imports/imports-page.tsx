"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Account, listAccounts } from "../../lib/api/accounts";
import {
  AmountSignConvention,
  confirmCsvImport,
  CsvImportHistoryItem,
  CsvImportPreviewResponse,
  CsvImportUploadResponse,
  listCsvImports,
  previewCsvImport,
  uploadCsvImport
} from "../../lib/api/imports";

type ImportsPageProps = {
  accessToken: string;
  currentUser: {
    displayName: string;
    email: string;
  };
  message: string | null;
  navigation: React.ReactNode;
  onLogout: () => void;
};

type MappingForm = {
  accountId: string;
  amount: string;
  amountSignConvention: AmountSignConvention;
  merchant: string;
  transactionAt: string;
};

const initialMapping: MappingForm = {
  accountId: "",
  amount: "",
  amountSignConvention: "positive_income",
  merchant: "",
  transactionAt: ""
};

export function ImportsPage({
  accessToken,
  currentUser,
  message: sessionMessage,
  navigation,
  onLogout
}: ImportsPageProps): React.ReactElement {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [history, setHistory] = useState<CsvImportHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mapping, setMapping] = useState<MappingForm>(initialMapping);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvImportPreviewResponse | null>(null);
  const [upload, setUpload] = useState<CsvImportUploadResponse | null>(null);

  const loadWorkspace = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setMessage(null);

    try {
      const [accountResponse, importResponse] = await Promise.all([
        listAccounts(accessToken),
        listCsvImports(accessToken)
      ]);
      setAccounts(accountResponse.items);
      setHistory(importResponse.items);
      setMapping((current) => ({
        ...current,
        accountId: current.accountId || (accountResponse.items[0]?.id ?? "")
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat workspace import.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function handleUpload(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (file === null) {
      setMessage("Pilih file CSV terlebih dahulu.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setPreview(null);

    try {
      const response = await uploadCsvImport(accessToken, file);
      setUpload(response);
      setMapping((current) => ({
        ...current,
        amount: findSuggestedColumn(response.detectedColumns, ["amount", "nominal"]),
        merchant: findSuggestedColumn(response.detectedColumns, ["description", "merchant"]),
        transactionAt: findSuggestedColumn(response.detectedColumns, ["date", "transactionat"])
      }));
      await loadHistory();
      setMessage("CSV berhasil di-upload. Pilih mapping lalu preview.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal upload CSV.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePreview(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (upload === null) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await previewCsvImport(accessToken, upload.importId, {
        accountId: mapping.accountId,
        amountSignConvention: mapping.amountSignConvention,
        mapping: {
          amount: mapping.amount,
          merchant: mapping.merchant || undefined,
          transactionAt: mapping.transactionAt
        }
      });
      setPreview(response);
      setMessage(response.summary.invalidRowCount === 0
        ? "Semua row valid. Import siap dikonfirmasi."
        : "Periksa row invalid sebelum mengonfirmasi import.");
      await loadHistory();
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "Gagal membuat preview.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirm(): Promise<void> {
    if (upload === null || !canConfirm(preview)) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const completed = await confirmCsvImport(accessToken, upload.importId);
      setUpload(null);
      setPreview(null);
      setFile(null);
      setMapping((current) => ({
        ...initialMapping,
        accountId: current.accountId
      }));
      await loadHistory();
      setMessage(`${completed.summary.importedRowCount} transaksi berhasil di-import.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengonfirmasi import.");
    } finally {
      setIsSaving(false);
    }
  }

  async function loadHistory(): Promise<void> {
    const response = await listCsvImports(accessToken);

    setHistory(response.items);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Money Tracker</p>
          <h1>Import CSV</h1>
          <p className="user-line">{currentUser.displayName} / {currentUser.email}</p>
        </div>
        <div className="topbar-actions">
          <span>{history.length} recent imports</span>
          <button className="secondary-inline-button" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      {navigation}

      <section className="import-layout">
        <section className="tool-panel">
          <div className="panel-heading">
            <h2>1. Upload Statement</h2>
            <button className="secondary-button" disabled={isLoading} onClick={() => void loadWorkspace()} type="button">
              {isLoading ? "Loading" : "Refresh"}
            </button>
          </div>
          <p className="helper-line">
            UTF-8 CSV, maximum 1 MiB and 1,000 rows. Use plain decimal amounts without thousands separators.
          </p>
          <form className="resource-edit-form" onSubmit={(event) => void handleUpload(event)}>
            <label className="field">
              <span>CSV file</span>
              <input
                accept=".csv,text/csv"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
            <button className="primary-button" disabled={isSaving || file === null} type="submit">
              {isSaving ? "Uploading" : "Upload CSV"}
            </button>
          </form>
          {message !== null ? <p className="status-line">{message}</p> : null}
          {sessionMessage !== null ? <p className="status-line">{sessionMessage}</p> : null}
        </section>

        <section className="tool-panel">
          <div className="panel-heading">
            <h2>2. Map And Preview</h2>
            <span>{upload === null ? "Upload required" : `${upload.rowCount} rows`}</span>
          </div>
          {upload === null ? (
            <div className="empty-state">
              <p>Upload a CSV statement to configure its columns.</p>
            </div>
          ) : (
            <form className="resource-edit-form" onSubmit={(event) => void handlePreview(event)}>
              <label className="field">
                <span>Destination account</span>
                <select
                  onChange={(event) => setMapping({ ...mapping, accountId: event.target.value })}
                  required
                  value={mapping.accountId}
                >
                  <option value="">Choose account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} / {account.currency}
                    </option>
                  ))}
                </select>
              </label>
              <ColumnSelect
                columns={upload.detectedColumns}
                label="Date column"
                onChange={(transactionAt) => setMapping({ ...mapping, transactionAt })}
                required
                value={mapping.transactionAt}
              />
              <ColumnSelect
                columns={upload.detectedColumns}
                label="Signed amount column"
                onChange={(amount) => setMapping({ ...mapping, amount })}
                required
                value={mapping.amount}
              />
              <ColumnSelect
                columns={upload.detectedColumns}
                label="Merchant column (optional)"
                onChange={(merchant) => setMapping({ ...mapping, merchant })}
                value={mapping.merchant}
              />
              <label className="field">
                <span>Amount sign convention</span>
                <select
                  onChange={(event) => setMapping({
                    ...mapping,
                    amountSignConvention: event.target.value as AmountSignConvention
                  })}
                  value={mapping.amountSignConvention}
                >
                  <option value="positive_income">Positive = income</option>
                  <option value="positive_expense">Positive = expense</option>
                </select>
              </label>
              <button className="primary-button" disabled={isSaving || accounts.length === 0} type="submit">
                {isSaving ? "Validating" : "Preview And Validate"}
              </button>
            </form>
          )}
        </section>
      </section>

      <section className="tool-panel import-preview-panel">
        <div className="panel-heading">
          <h2>3. Preview</h2>
          <button
            className="primary-button"
            disabled={isSaving || !canConfirm(preview)}
            onClick={() => void handleConfirm()}
            type="button"
          >
            {isSaving ? "Importing" : "Confirm Import"}
          </button>
        </div>
        {preview === null ? (
          <div className="empty-state">
            <p>Preview validated rows before confirming the ledger import.</p>
          </div>
        ) : (
          <>
            <p className="helper-line">
              {preview.summary.validRowCount} valid / {preview.summary.invalidRowCount} invalid /
              {" "}{preview.summary.incomeRowCount} income / {preview.summary.expenseRowCount} expense
            </p>
            <div className="import-row-list">
              {preview.rows.map((row) => (
                <article className={row.errors.length === 0 ? "import-row" : "import-row import-row-invalid"} key={row.rowNumber}>
                  <div>
                    <strong>Row {row.rowNumber}</strong>
                    <p>{row.merchant ?? "No merchant"}</p>
                    {row.errors.map((error) => (
                      <p className="import-error" key={`${error.field}-${error.code}`}>
                        {error.field}: {error.message}
                      </p>
                    ))}
                  </div>
                  <div className="balance-block">
                    <strong>{row.type ?? "Invalid"}</strong>
                    <span>{row.amount === null ? "-" : `${row.currency} ${row.amount}`}</span>
                    <span>{row.transactionAt ?? "Invalid date"}</span>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="tool-panel import-history-panel">
        <div className="panel-heading">
          <h2>Recent Import History</h2>
          <span>Safe summary only</span>
        </div>
        {history.length === 0 ? (
          <div className="empty-state">
            <p>No CSV imports yet.</p>
          </div>
        ) : (
          <div className="import-row-list">
            {history.map((item) => (
              <article className="import-row" key={item.id}>
                <div>
                  <strong>{item.filename}</strong>
                  <p>{formatDate(item.completedAt ?? item.createdAt)}</p>
                </div>
                <div className="balance-block">
                  <strong>{item.status}</strong>
                  <span>{item.summary.importedRowCount} imported / {item.summary.totalRowCount} total</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ColumnSelect({
  columns,
  label,
  onChange,
  required = false,
  value
}: {
  columns: string[];
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}): React.ReactElement {
  return (
    <label className="field">
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} required={required} value={value}>
        <option value="">Not mapped</option>
        {columns.map((column) => (
          <option key={column} value={column}>{column}</option>
        ))}
      </select>
    </label>
  );
}

function canConfirm(preview: CsvImportPreviewResponse | null): boolean {
  return preview !== null
    && preview.status === "ready_to_import"
    && preview.summary.invalidRowCount === 0
    && preview.summary.validRowCount > 0;
}

function findSuggestedColumn(columns: string[], candidates: string[]): string {
  return columns.find((column) => candidates.includes(column.toLocaleLowerCase())) ?? "";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("id-ID");
}
