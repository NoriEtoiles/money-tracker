"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Account, listAccounts } from "../../lib/api/accounts";
import {
  archiveBudget,
  Budget,
  createBudget,
  listBudgets,
  updateBudget
} from "../../lib/api/budgets";
import { Category, listCategories } from "../../lib/api/categories";
import { CategorySelector } from "../categories/category-selector";

type BudgetsPageProps = {
  accessToken: string;
  currentUser: {
    displayName: string;
    email: string;
  };
  message: string | null;
  navigation: React.ReactNode;
  onLogout: () => void;
};

type BudgetForm = {
  amount: string;
  categoryId: string;
  currency: string;
  month: string;
  thresholdPercentage: string;
};

const initialForm: BudgetForm = {
  amount: "",
  categoryId: "",
  currency: "IDR",
  month: toMonthValue(new Date()),
  thresholdPercentage: "80"
};

export function BudgetsPage({
  accessToken,
  currentUser,
  message: sessionMessage,
  navigation,
  onLogout
}: BudgetsPageProps): React.ReactElement {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<BudgetForm>(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<BudgetForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState("IDR");
  const [selectedMonth, setSelectedMonth] = useState(toMonthValue(new Date()));

  const currencyOptions = useMemo(() => {
    const currencies = new Set(["IDR"]);

    accounts.forEach((account) => currencies.add(account.currency));

    return [...currencies].sort();
  }, [accounts]);

  useEffect(() => {
    async function loadInitialWorkspace(): Promise<void> {
      setIsLoading(true);
      setMessage(null);

      try {
        const periodStart = monthToPeriodStart(selectedMonth);
        const [accountResponse, categoryResponse, budgetResponse] = await Promise.all([
          listAccounts(accessToken),
          listCategories(accessToken),
          listBudgets(accessToken, {
            currency: selectedCurrency,
            periodStart
          })
        ]);
        setAccounts(accountResponse.items);
        setCategories(categoryResponse.items);
        setBudgets(budgetResponse.items);
        setForm((current) => ({
          ...current,
          categoryId: current.categoryId || firstExpenseCategoryId(categoryResponse.items),
          currency: selectedCurrency,
          month: selectedMonth
        }));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Gagal memuat budget.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadInitialWorkspace();
  }, [accessToken, selectedCurrency, selectedMonth]);

  async function loadWorkspace(): Promise<void> {
    setIsLoading(true);
    setMessage(null);

    try {
      const periodStart = monthToPeriodStart(selectedMonth);
      const [accountResponse, categoryResponse, budgetResponse] = await Promise.all([
        listAccounts(accessToken),
        listCategories(accessToken),
        listBudgets(accessToken, {
          currency: selectedCurrency,
          periodStart
        })
      ]);
      setAccounts(accountResponse.items);
      setCategories(categoryResponse.items);
      setBudgets(budgetResponse.items);
      setForm((current) => ({
        ...current,
        categoryId: current.categoryId || firstExpenseCategoryId(categoryResponse.items),
        currency: selectedCurrency,
        month: selectedMonth
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat budget.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await createBudget(accessToken, {
        amount: form.amount.trim(),
        categoryId: form.categoryId,
        currency: form.currency,
        periodStart: monthToPeriodStart(form.month),
        thresholdPercentage: Number(form.thresholdPercentage)
      });
      setForm({
        ...initialForm,
        categoryId: form.categoryId,
        currency: selectedCurrency,
        month: selectedMonth
      });
      await loadWorkspace();
      setMessage("Budget berhasil dibuat.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuat budget.");
    } finally {
      setIsSaving(false);
    }
  }

  function beginEdit(budget: Budget): void {
    setEditingBudgetId(budget.id);
    setEditForm({
      amount: budget.amount,
      categoryId: budget.category.id,
      currency: budget.currency,
      month: budget.periodStart.slice(0, 7),
      thresholdPercentage: budget.thresholdPercentage
    });
    setMessage(null);
  }

  function cancelEdit(): void {
    setEditingBudgetId(null);
    setEditForm(null);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>, budgetId: string): Promise<void> {
    event.preventDefault();

    if (editForm === null) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      await updateBudget(accessToken, budgetId, {
        amount: editForm.amount.trim(),
        categoryId: editForm.categoryId,
        currency: editForm.currency,
        periodStart: monthToPeriodStart(editForm.month),
        thresholdPercentage: Number(editForm.thresholdPercentage)
      });
      cancelEdit();
      await loadWorkspace();
      setMessage("Budget berhasil diperbarui.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memperbarui budget.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive(budgetId: string): Promise<void> {
    setMessage(null);

    try {
      await archiveBudget(accessToken, budgetId);
      await loadWorkspace();
      setMessage("Budget berhasil diarsipkan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengarsipkan budget.");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Money Tracker</p>
          <h1>Budgets</h1>
          <p className="user-line">{currentUser.displayName} / {currentUser.email}</p>
        </div>
        <div className="topbar-actions">
          <span>{budgets.length} active</span>
          <button className="secondary-inline-button" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      {navigation}

      <section className="workspace-grid" aria-label="Budget workspace">
        <form className="tool-panel" onSubmit={(event) => void handleCreate(event)}>
          <div className="panel-heading">
            <h2>Add Budget</h2>
            <button
              className="primary-button"
              disabled={isSaving || form.categoryId.length === 0}
              type="submit"
            >
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

          <BudgetControls
            currencyOptions={currencyOptions}
            month={selectedMonth}
            onCurrencyChange={(currency) => {
              setSelectedCurrency(currency);
              setForm((current) => ({ ...current, currency }));
            }}
            onMonthChange={(month) => {
              setSelectedMonth(month);
              setForm((current) => ({ ...current, month }));
            }}
            selectedCurrency={selectedCurrency}
          />

          <BudgetFields
            categories={categories}
            currencyOptions={currencyOptions}
            form={form}
            onChange={setForm}
          />

          {message !== null ? <p className="status-line">{message}</p> : null}
          {sessionMessage !== null ? <p className="status-line">{sessionMessage}</p> : null}
        </form>

        <section className="resource-list" aria-label="Budgets">
          {budgets.length === 0 ? (
            <div className="empty-state">
              <h2>No budgets yet</h2>
              <p>Budget helps you control category spending before it crosses the limit.</p>
            </div>
          ) : (
            budgets.map((budget) => (
              <article className="resource-row transaction-row" key={budget.id}>
                {editingBudgetId === budget.id && editForm !== null ? (
                  <form
                    className="resource-edit-form transaction-edit-form"
                    onSubmit={(event) => void handleEditSubmit(event, budget.id)}
                  >
                    <BudgetFields
                      categories={categories}
                      currencyOptions={currencyOptions}
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
                      <h2>{budget.category.name}</h2>
                      <p>
                        {formatMonthLabel(budget.periodStart)} / {budget.currency}
                      </p>
                      <BudgetProgress budget={budget} />
                    </div>
                    <div className="balance-block">
                      <strong>
                        {formatMoney(budget.spentAmount, budget.currency)} / {formatMoney(budget.amount, budget.currency)}
                      </strong>
                      <span className={budget.isThresholdExceeded ? "budget-warning" : undefined}>
                        {formatMoney(budget.remainingAmount, budget.currency)} left
                      </span>
                    </div>
                    <div className="row-actions">
                      <button
                        className="secondary-inline-button"
                        onClick={() => beginEdit(budget)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="danger-button"
                        onClick={() => void handleArchive(budget.id)}
                        type="button"
                      >
                        Archive
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}

function BudgetControls({
  currencyOptions,
  month,
  onCurrencyChange,
  onMonthChange,
  selectedCurrency
}: {
  currencyOptions: string[];
  month: string;
  onCurrencyChange: (currency: string) => void;
  onMonthChange: (month: string) => void;
  selectedCurrency: string;
}): React.ReactElement {
  return (
    <div className="form-grid">
      <label className="field">
        <span>Month</span>
        <input
          onChange={(event) => onMonthChange(event.target.value)}
          required
          type="month"
          value={month}
        />
      </label>

      <label className="field">
        <span>Currency</span>
        <select
          onChange={(event) => onCurrencyChange(event.target.value)}
          value={selectedCurrency}
        >
          {currencyOptions.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function BudgetFields({
  categories,
  currencyOptions,
  form,
  onChange
}: {
  categories: Category[];
  currencyOptions: string[];
  form: BudgetForm;
  onChange: (form: BudgetForm) => void;
}): React.ReactElement {
  return (
    <div className="form-grid">
      <CategorySelector
        categories={categories}
        kind="expense"
        label="Expense category"
        onChange={(categoryId) => onChange({ ...form, categoryId })}
        value={form.categoryId}
      />

      <label className="field">
        <span>Month</span>
        <input
          onChange={(event) => onChange({ ...form, month: event.target.value })}
          required
          type="month"
          value={form.month}
        />
      </label>

      <label className="field">
        <span>Currency</span>
        <select
          onChange={(event) => onChange({ ...form, currency: event.target.value })}
          value={form.currency}
        >
          {currencyOptions.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
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

      <label className="field">
        <span>Threshold %</span>
        <input
          inputMode="decimal"
          max={100}
          min={1}
          onChange={(event) => onChange({ ...form, thresholdPercentage: event.target.value })}
          required
          type="number"
          value={form.thresholdPercentage}
        />
      </label>
    </div>
  );
}

function BudgetProgress({ budget }: { budget: Budget }): React.ReactElement {
  const percentage = Math.max(0, Math.min(Number(budget.spentPercentage), 100));

  return (
    <div className="budget-progress" aria-label={`${budget.spentPercentage}% spent`}>
      <div className="budget-progress-bar">
        <div
          className={budget.isThresholdExceeded
            ? "budget-progress-fill budget-progress-warning"
            : "budget-progress-fill"}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span>{budget.spentPercentage}% spent</span>
    </div>
  );
}

function firstExpenseCategoryId(categories: Category[]): string {
  return categories.find((category) => category.kind === "expense")?.id ?? "";
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

function monthToPeriodStart(month: string): string {
  return `${month}-01`;
}

function toMonthValue(date: Date): string {
  return date.toISOString().slice(0, 7);
}
