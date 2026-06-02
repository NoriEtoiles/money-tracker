"use client";

import { FormEvent, useEffect, useState } from "react";
import { Account, listAccounts } from "../../lib/api/accounts";
import { Category, listCategories } from "../../lib/api/categories";
import {
  archiveRecurringRule,
  createRecurringRule,
  listRecurringRules,
  pauseRecurringRule,
  RecurringFrequency,
  RecurringRule,
  resumeRecurringRule,
  updateRecurringRule
} from "../../lib/api/recurring-rules";
import { TransactionType } from "../../lib/api/transactions";
import { CategorySelector } from "../categories/category-selector";

type RecurringPageProps = {
  accessToken: string;
  currentUser: {
    displayName: string;
    email: string;
  };
  message: string | null;
  navigation: React.ReactNode;
  onLogout: () => void;
};

type RecurringForm = {
  accountId: string;
  amount: string;
  categoryId: string;
  endAt: string;
  frequency: RecurringFrequency;
  intervalCount: string;
  merchant: string;
  name: string;
  startAt: string;
  type: TransactionType;
};

const initialForm: RecurringForm = {
  accountId: "",
  amount: "",
  categoryId: "",
  endAt: "",
  frequency: "monthly",
  intervalCount: "1",
  merchant: "",
  name: "",
  startAt: toLocalDateTimeValue(new Date(Date.now() + 5 * 60 * 1000).toISOString()),
  type: "expense"
};

export function RecurringPage({
  accessToken,
  currentUser,
  message: sessionMessage,
  navigation,
  onLogout
}: RecurringPageProps): React.ReactElement {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RecurringForm | null>(null);
  const [form, setForm] = useState<RecurringForm>(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rules, setRules] = useState<RecurringRule[]>([]);

  useEffect(() => {
    async function loadInitialWorkspace(): Promise<void> {
      setIsLoading(true);
      setMessage(null);

      try {
        const [accountResponse, categoryResponse, recurringResponse] = await Promise.all([
          listAccounts(accessToken),
          listCategories(accessToken),
          listRecurringRules(accessToken)
        ]);
        setAccounts(accountResponse.items);
        setCategories(categoryResponse.items);
        setRules(recurringResponse.items);
        setForm((current) => ({
          ...current,
          accountId: current.accountId || (accountResponse.items[0]?.id ?? "")
        }));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Gagal memuat recurring rules.");
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
      const [accountResponse, categoryResponse, recurringResponse] = await Promise.all([
        listAccounts(accessToken),
        listCategories(accessToken),
        listRecurringRules(accessToken)
      ]);
      setAccounts(accountResponse.items);
      setCategories(categoryResponse.items);
      setRules(recurringResponse.items);
      setForm((current) => ({
        ...current,
        accountId: current.accountId || (accountResponse.items[0]?.id ?? "")
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat recurring rules.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await createRecurringRule(accessToken, toRuleInput(form, accounts));
      setForm({
        ...initialForm,
        accountId: form.accountId,
        startAt: toLocalDateTimeValue(new Date(Date.now() + 5 * 60 * 1000).toISOString())
      });
      await loadWorkspace();
      setMessage("Recurring rule berhasil dibuat.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuat recurring rule.");
    } finally {
      setIsSaving(false);
    }
  }

  function beginEdit(rule: RecurringRule): void {
    setEditingRuleId(rule.id);
    setEditForm({
      accountId: rule.template.accountId,
      amount: rule.template.amount,
      categoryId: rule.template.categoryId ?? "",
      endAt: rule.endAt === null ? "" : toLocalDateTimeValue(rule.endAt),
      frequency: rule.frequency,
      intervalCount: String(rule.intervalCount),
      merchant: rule.template.merchant ?? "",
      name: rule.name,
      startAt: toLocalDateTimeValue(rule.startAt),
      type: rule.template.type
    });
    setMessage(null);
  }

  function cancelEdit(): void {
    setEditingRuleId(null);
    setEditForm(null);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>, ruleId: string): Promise<void> {
    event.preventDefault();

    if (editForm === null) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      await updateRecurringRule(accessToken, ruleId, {
        ...toRuleInput(editForm, accounts),
        endAt: editForm.endAt.length === 0 ? null : toIsoDateTime(editForm.endAt)
      });
      cancelEdit();
      await loadWorkspace();
      setMessage("Recurring rule berhasil diperbarui.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memperbarui recurring rule.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePause(ruleId: string): Promise<void> {
    await runLifecycleAction(
      () => pauseRecurringRule(accessToken, ruleId),
      "Recurring rule dijeda.",
      "Gagal menjeda recurring rule."
    );
  }

  async function handleResume(ruleId: string): Promise<void> {
    await runLifecycleAction(
      () => resumeRecurringRule(accessToken, ruleId),
      "Recurring rule dilanjutkan.",
      "Gagal melanjutkan recurring rule."
    );
  }

  async function handleArchive(ruleId: string): Promise<void> {
    await runLifecycleAction(
      () => archiveRecurringRule(accessToken, ruleId),
      "Recurring rule diarsipkan.",
      "Gagal mengarsipkan recurring rule."
    );
  }

  async function runLifecycleAction(
    action: () => Promise<unknown>,
    successMessage: string,
    failureMessage: string
  ): Promise<void> {
    setMessage(null);

    try {
      await action();
      await loadWorkspace();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : failureMessage);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Money Tracker</p>
          <h1>Recurring</h1>
          <p className="user-line">{currentUser.displayName} / {currentUser.email}</p>
        </div>
        <div className="topbar-actions">
          <span>{rules.length} rules</span>
          <button className="secondary-inline-button" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      {navigation}

      <section className="workspace-grid" aria-label="Recurring rule workspace">
        <form className="tool-panel" onSubmit={(event) => void handleCreate(event)}>
          <div className="panel-heading">
            <h2>Add Recurring Rule</h2>
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

          <RecurringFields accounts={accounts} categories={categories} form={form} onChange={setForm} />

          {message !== null ? <p className="status-line">{message}</p> : null}
          {sessionMessage !== null ? <p className="status-line">{sessionMessage}</p> : null}
        </form>

        <section className="resource-list" aria-label="Recurring rules">
          {rules.length === 0 ? (
            <div className="empty-state">
              <h2>No recurring rules yet</h2>
              <p>Create a schedule for income or expenses that repeat automatically.</p>
            </div>
          ) : (
            rules.map((rule) => (
              <article className="resource-row recurring-row" key={rule.id}>
                {editingRuleId === rule.id && editForm !== null ? (
                  <form
                    className="resource-edit-form transaction-edit-form"
                    onSubmit={(event) => void handleEditSubmit(event, rule.id)}
                  >
                    <RecurringFields
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
                      <h2>{rule.name}</h2>
                      <p>
                        {formatSchedule(rule)} / {rule.timezone}
                      </p>
                      {rule.lastGenerationErrorCode !== null ? (
                        <p className="recurring-error">{formatErrorCode(rule.lastGenerationErrorCode)}</p>
                      ) : null}
                    </div>
                    <div className="balance-block">
                      <strong className={rule.template.type === "income" ? "amount-income" : "amount-expense"}>
                        {rule.template.type === "income" ? "+" : "-"}
                        {formatMoney(rule.template.amount, rule.template.currency)}
                      </strong>
                      <span>{formatNextRun(rule)}</span>
                      <span className={`status-pill status-pill-${rule.status}`}>{rule.status}</span>
                    </div>
                    <div className="row-actions">
                      <button
                        className="secondary-inline-button"
                        onClick={() => beginEdit(rule)}
                        type="button"
                      >
                        Edit
                      </button>
                      {rule.status === "paused" ? (
                        <button
                          className="secondary-inline-button"
                          onClick={() => void handleResume(rule.id)}
                          type="button"
                        >
                          Resume
                        </button>
                      ) : (
                        <button
                          className="secondary-inline-button"
                          disabled={rule.status === "completed"}
                          onClick={() => void handlePause(rule.id)}
                          type="button"
                        >
                          Pause
                        </button>
                      )}
                      <button
                        className="danger-button"
                        onClick={() => void handleArchive(rule.id)}
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

function RecurringFields({
  accounts,
  categories,
  form,
  onChange
}: {
  accounts: Account[];
  categories: Category[];
  form: RecurringForm;
  onChange: (form: RecurringForm) => void;
}): React.ReactElement {
  return (
    <div className="form-grid">
      <label className="field">
        <span>Name</span>
        <input
          maxLength={120}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          required
          value={form.name}
        />
      </label>

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
        <span>Merchant</span>
        <input
          maxLength={120}
          onChange={(event) => onChange({ ...form, merchant: event.target.value })}
          value={form.merchant}
        />
      </label>

      <label className="field">
        <span>Frequency</span>
        <select
          onChange={(event) => onChange({ ...form, frequency: event.target.value as RecurringFrequency })}
          value={form.frequency}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </label>

      <label className="field">
        <span>Every</span>
        <input
          min={1}
          onChange={(event) => onChange({ ...form, intervalCount: event.target.value })}
          required
          type="number"
          value={form.intervalCount}
        />
      </label>

      <label className="field">
        <span>First run</span>
        <input
          onChange={(event) => onChange({ ...form, startAt: event.target.value })}
          required
          type="datetime-local"
          value={form.startAt}
        />
      </label>

      <label className="field">
        <span>End at (optional)</span>
        <input
          onChange={(event) => onChange({ ...form, endAt: event.target.value })}
          type="datetime-local"
          value={form.endAt}
        />
      </label>
    </div>
  );
}

function toRuleInput(form: RecurringForm, accounts: Account[]): {
  endAt?: string;
  frequency: RecurringFrequency;
  intervalCount: number;
  name: string;
  startAt: string;
  template: {
    accountId: string;
    amount: string;
    categoryId?: string;
    currency: string;
    merchant?: string;
    type: TransactionType;
  };
} {
  return {
    endAt: form.endAt.length === 0 ? undefined : toIsoDateTime(form.endAt),
    frequency: form.frequency,
    intervalCount: Number(form.intervalCount),
    name: form.name.trim(),
    startAt: toIsoDateTime(form.startAt),
    template: {
      accountId: form.accountId,
      amount: form.amount.trim(),
      categoryId: form.categoryId || undefined,
      currency: selectedAccountCurrency(form.accountId, accounts),
      merchant: form.merchant.trim() || undefined,
      type: form.type
    }
  };
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

function formatSchedule(rule: RecurringRule): string {
  const unit = rule.frequency === "daily"
    ? "day"
    : rule.frequency === "weekly"
      ? "week"
      : "month";

  return `Every ${rule.intervalCount} ${unit}${rule.intervalCount === 1 ? "" : "s"}`;
}

function formatNextRun(rule: RecurringRule): string {
  if (rule.nextRunAt === null) {
    return "Schedule completed";
  }

  return `Next ${new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(rule.nextRunAt))}`;
}

function formatErrorCode(errorCode: string): string {
  if (errorCode === "ACCOUNT_UNAVAILABLE") {
    return "Paused: account is unavailable. Edit the rule before resuming.";
  }

  if (errorCode === "CATEGORY_UNAVAILABLE") {
    return "Paused: category is unavailable. Edit the rule before resuming.";
  }

  return "Paused: rule template needs review.";
}

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat("id-ID", {
    currency,
    style: "currency"
  }).format(Number(amount));
}
