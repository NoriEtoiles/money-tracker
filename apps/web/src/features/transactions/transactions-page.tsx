"use client";

import { FormEvent, useEffect, useState } from "react";
import { Account, listAccounts } from "../../lib/api/accounts";
import { Category, listCategories } from "../../lib/api/categories";
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  Transaction,
  TransactionListFilters,
  TransactionType,
  updateTransaction
} from "../../lib/api/transactions";
import { CategorySelector } from "../categories/category-selector";

type TransactionsPageProps = {
  accessToken: string;
  currentUser: {
    displayName: string;
    email: string;
  };
  message: string | null;
  navigation: React.ReactNode;
  onLogout: () => void;
};

type TransactionForm = {
  accountId: string;
  amount: string;
  categoryId: string;
  merchant: string;
  note: string;
  transactionAt: string;
  type: TransactionType;
};

const initialForm: TransactionForm = {
  accountId: "",
  amount: "",
  categoryId: "",
  merchant: "",
  note: "",
  transactionAt: toLocalDateTimeValue(new Date().toISOString()),
  type: "expense"
};

const initialFilters: TransactionListFilters = {};

export function TransactionsPage({
  accessToken,
  currentUser,
  message: sessionMessage,
  navigation,
  onLogout
}: TransactionsPageProps): React.ReactElement {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<TransactionListFilters>(initialFilters);
  const [form, setForm] = useState<TransactionForm>(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TransactionForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    async function loadInitialWorkspace(): Promise<void> {
      setIsLoading(true);
      setMessage(null);

      try {
        const [accountResponse, categoryResponse, transactionResponse] = await Promise.all([
          listAccounts(accessToken),
          listCategories(accessToken),
          listTransactions(accessToken, initialFilters)
        ]);
        setAccounts(accountResponse.items);
        setCategories(categoryResponse.items);
        setTransactions(transactionResponse.items);
        setNextCursor(transactionResponse.nextCursor);
        setForm((current) => ({
          ...current,
          accountId: current.accountId || (accountResponse.items[0]?.id ?? "")
        }));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Gagal memuat transaksi.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadInitialWorkspace();
  }, [accessToken]);

  async function loadWorkspace(): Promise<void> {
    setIsLoading(true);
    setMessage(null);

    try {
      const [accountResponse, categoryResponse, transactionResponse] = await Promise.all([
        listAccounts(accessToken),
        listCategories(accessToken),
        listTransactions(accessToken, filters)
      ]);
      setAccounts(accountResponse.items);
      setCategories(categoryResponse.items);
      setTransactions(transactionResponse.items);
      setNextCursor(transactionResponse.nextCursor);
      setForm((current) => ({
        ...current,
        accountId: current.accountId || (accountResponse.items[0]?.id ?? "")
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat transaksi.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTransactionList(nextFilters: TransactionListFilters): Promise<void> {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await listTransactions(accessToken, nextFilters);
      setTransactions(response.items);
      setNextCursor(response.nextCursor);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat transaksi.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await createTransaction(accessToken, {
        accountId: form.accountId,
        amount: form.amount.trim(),
        categoryId: form.categoryId || undefined,
        currency: selectedAccountCurrency(form.accountId, accounts),
        merchant: form.merchant.trim() || undefined,
        note: form.note.trim() || undefined,
        transactionAt: toIsoDateTime(form.transactionAt),
        type: form.type
      });
      setForm({
        ...initialForm,
        accountId: form.accountId,
        transactionAt: toLocalDateTimeValue(new Date().toISOString())
      });
      await loadWorkspace();
      setMessage("Transaksi berhasil dibuat.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuat transaksi.");
    } finally {
      setIsSaving(false);
    }
  }

  function beginEdit(transaction: Transaction): void {
    setEditingTransactionId(transaction.id);
    setEditForm({
      accountId: transaction.account.id,
      amount: transaction.amount,
      categoryId: transaction.category?.id ?? "",
      merchant: transaction.merchant ?? "",
      note: transaction.note ?? "",
      transactionAt: toLocalDateTimeValue(transaction.transactionAt),
      type: transaction.type
    });
    setMessage(null);
  }

  function cancelEdit(): void {
    setEditingTransactionId(null);
    setEditForm(null);
  }

  async function handleEditSubmit(
    event: FormEvent<HTMLFormElement>,
    transactionId: string
  ): Promise<void> {
    event.preventDefault();

    if (editForm === null) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      await updateTransaction(accessToken, transactionId, {
        accountId: editForm.accountId,
        amount: editForm.amount.trim(),
        categoryId: editForm.categoryId || null,
        currency: selectedAccountCurrency(editForm.accountId, accounts),
        merchant: editForm.merchant.trim(),
        note: editForm.note.trim(),
        transactionAt: toIsoDateTime(editForm.transactionAt),
        type: editForm.type
      });
      cancelEdit();
      await loadWorkspace();
      setMessage("Transaksi berhasil diperbarui.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memperbarui transaksi.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(transactionId: string): Promise<void> {
    setMessage(null);

    try {
      await deleteTransaction(accessToken, transactionId);
      await loadWorkspace();
      setMessage("Transaksi berhasil dihapus.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menghapus transaksi.");
    }
  }

  async function handleFilterSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await loadTransactionList(filters);
  }

  async function handleLoadMore(): Promise<void> {
    if (nextCursor === null) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await listTransactions(accessToken, {
        ...filters,
        cursor: nextCursor
      });
      setTransactions((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat transaksi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Money Tracker</p>
          <h1>Transactions</h1>
          <p className="user-line">{currentUser.displayName} / {currentUser.email}</p>
        </div>
        <div className="topbar-actions">
          <span>{transactions.length} shown</span>
          <button className="secondary-inline-button" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      {navigation}

      <section className="workspace-grid" aria-label="Transaction workspace">
        <form className="tool-panel" onSubmit={(event) => void handleCreate(event)}>
          <div className="panel-heading">
            <h2>Add Transaction</h2>
            <button className="primary-button" disabled={isSaving || accounts.length === 0} type="submit">
              {isSaving ? "Saving" : "Save"}
            </button>
          </div>

          <button
            className="secondary-button"
            disabled={isLoading}
            onClick={() => void loadWorkspace()}
            type="button"
          >
            {isLoading ? "Loading" : "Refresh"}
          </button>

          <TransactionFields
            accounts={accounts}
            categories={categories}
            form={form}
            onChange={setForm}
          />

          {message !== null ? <p className="status-line">{message}</p> : null}
          {sessionMessage !== null ? <p className="status-line">{sessionMessage}</p> : null}
        </form>

        <section className="resource-list" aria-label="Transactions">
          <form className="filter-panel" onSubmit={(event) => void handleFilterSubmit(event)}>
            <label className="field">
              <span>Search</span>
              <input
                maxLength={120}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                value={filters.search ?? ""}
              />
            </label>

            <label className="field">
              <span>Type</span>
              <select
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    type: event.target.value === "" ? undefined : event.target.value as TransactionType
                  })
                }
                value={filters.type ?? ""}
              >
                <option value="">All</option>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>

            <label className="field">
              <span>Account</span>
              <select
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    accountId: event.target.value || undefined
                  })
                }
                value={filters.accountId ?? ""}
              >
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            <button className="secondary-inline-button" disabled={isLoading} type="submit">
              Apply
            </button>
          </form>

          {transactions.length === 0 ? (
            <div className="empty-state">
              <h2>No transactions yet</h2>
              <p>Add income or expenses to start building your ledger.</p>
            </div>
          ) : (
            transactions.map((transaction) => (
              <article className="resource-row transaction-row" key={transaction.id}>
                {editingTransactionId === transaction.id && editForm !== null ? (
                  <form
                    className="resource-edit-form transaction-edit-form"
                    onSubmit={(event) => void handleEditSubmit(event, transaction.id)}
                  >
                    <TransactionFields
                      accounts={accounts}
                      categories={categories}
                      form={editForm}
                      onChange={setEditForm}
                    />
                    <div className="row-actions">
                      <button className="primary-button" disabled={isSaving} type="submit">
                        {isSaving ? "Saving" : "Save"}
                      </button>
                      <button className="secondary-inline-button" onClick={cancelEdit} type="button">
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div>
                      <h2>{transaction.category?.name ?? formatType(transaction.type)}</h2>
                      <p>
                        {transaction.merchant ?? "No merchant"} / {transaction.account.name}
                      </p>
                      {transaction.source === "recurring" ? (
                        <span className="source-pill">Recurring</span>
                      ) : null}
                      {transaction.source === "import" ? (
                        <span className="source-pill">Import</span>
                      ) : null}
                    </div>
                    <div className="balance-block">
                      <strong className={transaction.type === "income" ? "amount-income" : "amount-expense"}>
                        {transaction.type === "income" ? "+" : "-"}
                        {formatMoney(transaction.amount, transaction.currency)}
                      </strong>
                      <span>{formatTransactionDate(transaction.transactionAt)}</span>
                    </div>
                    <div className="row-actions">
                      <button
                        className="secondary-inline-button"
                        onClick={() => beginEdit(transaction)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="danger-button"
                        onClick={() => void handleDelete(transaction.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))
          )}

          {nextCursor !== null ? (
            <button
              className="secondary-button"
              disabled={isLoading}
              onClick={() => void handleLoadMore()}
              type="button"
            >
              {isLoading ? "Loading" : "Load more"}
            </button>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function TransactionFields({
  accounts,
  categories,
  form,
  onChange
}: {
  accounts: Account[];
  categories: Category[];
  form: TransactionForm;
  onChange: (form: TransactionForm) => void;
}): React.ReactElement {
  return (
    <div className="form-grid">
      <label className="field">
        <span>Type</span>
        <select
          onChange={(event) =>
            onChange({
              ...form,
              categoryId: "",
              type: event.target.value as TransactionType
            })
          }
          value={form.type}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </label>

      <label className="field">
        <span>Account</span>
        <select
          onChange={(event) => onChange({ ...form, accountId: event.target.value })}
          required
          value={form.accountId}
        >
          <option value="">Select account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} / {account.currency}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Amount</span>
        <input
          inputMode="decimal"
          onChange={(event) => onChange({ ...form, amount: event.target.value })}
          pattern="^(0|[1-9]\d*)(\.\d{1,4})?$"
          required
          value={form.amount}
        />
      </label>

      <CategorySelector
        categories={categories}
        kind={form.type}
        label="Category"
        onChange={(categoryId) => onChange({ ...form, categoryId })}
        placeholder="No category"
        value={form.categoryId}
      />

      <label className="field">
        <span>Date</span>
        <input
          onChange={(event) => onChange({ ...form, transactionAt: event.target.value })}
          required
          type="datetime-local"
          value={form.transactionAt}
        />
      </label>

      <label className="field">
        <span>Merchant</span>
        <input
          maxLength={120}
          onChange={(event) => onChange({ ...form, merchant: event.target.value })}
          value={form.merchant}
        />
      </label>

      <label className="field transaction-note-field">
        <span>Note</span>
        <input
          maxLength={500}
          onChange={(event) => onChange({ ...form, note: event.target.value })}
          value={form.note}
        />
      </label>
    </div>
  );
}

function selectedAccountCurrency(accountId: string, accounts: Account[]): string {
  return accounts.find((account) => account.id === accountId)?.currency ?? "IDR";
}

function toIsoDateTime(value: string): string {
  return new Date(value).toISOString();
}

function toLocalDateTimeValue(value: string): string {
  const date = new Date(value);
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat("id-ID", {
    currency,
    style: "currency"
  }).format(Number(amount));
}

function formatTransactionDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatType(type: TransactionType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
