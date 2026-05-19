"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Account,
  archiveAccount,
  createAccount,
  CreateAccountInput,
  listAccounts,
  updateAccount
} from "../../lib/api/accounts";

type AccountsPageProps = {
  accessToken: string;
  currentUser: {
    displayName: string;
    email: string;
  };
  message: string | null;
  navigation?: React.ReactNode;
  onLogout: () => void;
};

const accountTypes = [
  { label: "Cash", value: "cash" },
  { label: "Bank", value: "bank" },
  { label: "E-wallet", value: "e_wallet" },
  { label: "Credit card", value: "credit_card" }
] as const;

const initialForm: CreateAccountInput = {
  currency: "IDR",
  includeInNetWorth: true,
  initialBalance: "0",
  institutionName: "",
  name: "",
  sortOrder: 0,
  type: "cash"
};

type EditForm = {
  includeInNetWorth: boolean;
  institutionName: string;
  name: string;
  sortOrder: number;
};

export function AccountsPage({
  accessToken,
  currentUser,
  message: sessionMessage,
  navigation,
  onLogout
}: AccountsPageProps): React.ReactElement {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState<CreateAccountInput>(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const totalBalance = useMemo(() => {
    const total = accounts.reduce((sum, account) => {
      if (!account.includeInNetWorth) {
        return sum;
      }

      return addDecimalStrings(sum, account.currentBalance);
    }, "0");

    return new Intl.NumberFormat("id-ID", {
      currency: form.currency || "IDR",
      style: "currency"
    }).format(Number(total));
  }, [accounts, form.currency]);

  useEffect(() => {
    setIsLoading(true);
    listAccounts(accessToken)
      .then((response) => setAccounts(response.items))
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Gagal memuat akun.");
      })
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  async function loadAccounts(): Promise<void> {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await listAccounts(accessToken);
      setAccounts(response.items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat akun.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const account = await createAccount(accessToken, {
        ...form,
        currency: form.currency.toUpperCase(),
        institutionName: form.institutionName?.trim() || undefined,
        name: form.name.trim()
      });
      setAccounts((current) => [...current, account].sort((a, b) => a.sortOrder - b.sortOrder));
      setForm(initialForm);
      setMessage("Akun berhasil dibuat.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuat akun.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive(accountId: string): Promise<void> {
    setMessage(null);

    try {
      await archiveAccount(accessToken, accountId);
      setAccounts((current) => current.filter((account) => account.id !== accountId));
      setMessage("Akun berhasil diarsipkan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengarsipkan akun.");
    }
  }

  function beginEdit(account: Account): void {
    setEditingAccountId(account.id);
    setEditForm({
      includeInNetWorth: account.includeInNetWorth,
      institutionName: account.institutionName ?? "",
      name: account.name,
      sortOrder: account.sortOrder
    });
    setMessage(null);
  }

  function cancelEdit(): void {
    setEditingAccountId(null);
    setEditForm(null);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>, accountId: string): Promise<void> {
    event.preventDefault();

    if (editForm === null) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const updatedAccount = await updateAccount(accessToken, accountId, {
        includeInNetWorth: editForm.includeInNetWorth,
        institutionName: editForm.institutionName.trim() || undefined,
        name: editForm.name.trim(),
        sortOrder: editForm.sortOrder
      });
      setAccounts((current) =>
        current
          .map((account) => (account.id === accountId ? updatedAccount : account))
          .sort((a, b) => a.sortOrder - b.sortOrder)
      );
      cancelEdit();
      setMessage("Akun berhasil diperbarui.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memperbarui akun.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Money Tracker</p>
          <h1>Accounts</h1>
          <p className="user-line">{currentUser.displayName} / {currentUser.email}</p>
        </div>
        <div className="topbar-actions">
          <span>{totalBalance}</span>
          <button className="secondary-inline-button" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      {navigation}

      <section className="workspace-grid" aria-label="Account workspace">
        <form className="tool-panel" onSubmit={(event) => void handleCreate(event)}>
          <div className="panel-heading">
            <h2>Add Account</h2>
            <button className="primary-button" disabled={isSaving} type="submit">
              {isSaving ? "Saving" : "Save"}
            </button>
          </div>

          <button
            className="secondary-button"
            disabled={isLoading}
            onClick={() => void loadAccounts()}
            type="button"
          >
            {isLoading ? "Loading" : "Refresh"}
          </button>

          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input
                maxLength={120}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                value={form.name}
              />
            </label>

            <label className="field">
              <span>Type</span>
              <select
                onChange={(event) => setForm({ ...form, type: event.target.value })}
                value={form.type}
              >
                {accountTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Currency</span>
              <input
                maxLength={3}
                onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })}
                pattern="[A-Z]{3}"
                required
                value={form.currency}
              />
            </label>

            <label className="field">
              <span>Initial balance</span>
              <input
                inputMode="decimal"
                onChange={(event) => setForm({ ...form, initialBalance: event.target.value })}
                pattern="^(0|[1-9]\d*)(\.\d{1,4})?$"
                required
                value={form.initialBalance}
              />
            </label>

            <label className="field">
              <span>Institution</span>
              <input
                maxLength={120}
                onChange={(event) => setForm({ ...form, institutionName: event.target.value })}
                value={form.institutionName}
              />
            </label>

            <label className="field">
              <span>Sort order</span>
              <input
                min={0}
                onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
                type="number"
                value={form.sortOrder}
              />
            </label>
          </div>

          <label className="check-field">
            <input
              checked={form.includeInNetWorth}
              onChange={(event) => setForm({ ...form, includeInNetWorth: event.target.checked })}
              type="checkbox"
            />
            <span>Include in net worth</span>
          </label>

          {message !== null ? <p className="status-line">{message}</p> : null}
          {sessionMessage !== null ? <p className="status-line">{sessionMessage}</p> : null}
        </form>

        <section className="account-list" aria-label="Accounts">
          {accounts.length === 0 ? (
            <div className="empty-state">
              <h2>No accounts yet</h2>
              <p>Create your first wallet, bank account, e-wallet, or credit card.</p>
            </div>
          ) : (
            accounts.map((account) => (
              <article className="account-row" key={account.id}>
                {editingAccountId === account.id && editForm !== null ? (
                  <form
                    className="account-edit-form"
                    onSubmit={(event) => void handleEditSubmit(event, account.id)}
                  >
                    <label className="field">
                      <span>Name</span>
                      <input
                        maxLength={120}
                        onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                        required
                        value={editForm.name}
                      />
                    </label>

                    <label className="field">
                      <span>Institution</span>
                      <input
                        maxLength={120}
                        onChange={(event) =>
                          setEditForm({ ...editForm, institutionName: event.target.value })
                        }
                        value={editForm.institutionName}
                      />
                    </label>

                    <label className="field">
                      <span>Sort order</span>
                      <input
                        min={0}
                        onChange={(event) =>
                          setEditForm({ ...editForm, sortOrder: Number(event.target.value) })
                        }
                        type="number"
                        value={editForm.sortOrder}
                      />
                    </label>

                    <label className="check-field edit-check-field">
                      <input
                        checked={editForm.includeInNetWorth}
                        onChange={(event) =>
                          setEditForm({ ...editForm, includeInNetWorth: event.target.checked })
                        }
                        type="checkbox"
                      />
                      <span>Include in net worth</span>
                    </label>

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
                      <h2>{account.name}</h2>
                      <p>
                        {formatAccountType(account.type)}
                        {account.institutionName ? ` / ${account.institutionName}` : ""}
                      </p>
                    </div>
                    <div className="balance-block">
                      <strong>{formatMoney(account.currentBalance, account.currency)}</strong>
                      <span>{account.includeInNetWorth ? "Net worth" : "Hidden"}</span>
                    </div>
                    <div className="row-actions">
                      <button
                        className="secondary-inline-button"
                        onClick={() => beginEdit(account)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="danger-button"
                        onClick={() => void handleArchive(account.id)}
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

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat("id-ID", {
    currency,
    style: "currency"
  }).format(Number(amount));
}

function formatAccountType(type: string): string {
  return type
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function addDecimalStrings(left: string, right: string): string {
  const scale = 4;
  const totalMinorUnits = toMinorUnits(left, scale) + toMinorUnits(right, scale);
  const sign = totalMinorUnits < 0n ? "-" : "";
  const absolute = totalMinorUnits < 0n ? -totalMinorUnits : totalMinorUnits;
  const whole = absolute / 10000n;
  const fraction = (absolute % 10000n).toString().padStart(scale, "0");

  return `${sign}${whole.toString()}.${fraction}`;
}

function toMinorUnits(value: string, scale: number): bigint {
  const sign = value.startsWith("-") ? -1n : 1n;
  const normalizedValue = value.startsWith("-") ? value.slice(1) : value;
  const [whole = "0", fraction = ""] = normalizedValue.split(".");
  const paddedFraction = fraction.padEnd(scale, "0").slice(0, scale);

  return sign * (BigInt(whole) * 10000n + BigInt(paddedFraction));
}
