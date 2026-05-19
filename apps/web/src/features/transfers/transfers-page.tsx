"use client";

import { FormEvent, useEffect, useState } from "react";
import { Account, listAccounts } from "../../lib/api/accounts";
import {
  createTransfer,
  deleteTransfer,
  listTransfers,
  Transfer,
  updateTransfer
} from "../../lib/api/transfers";

type TransfersPageProps = {
  accessToken: string;
  currentUser: {
    displayName: string;
    email: string;
  };
  message: string | null;
  navigation: React.ReactNode;
  onLogout: () => void;
};

type TransferForm = {
  amount: string;
  fromAccountId: string;
  note: string;
  toAccountId: string;
  transactionAt: string;
};

const initialForm: TransferForm = {
  amount: "",
  fromAccountId: "",
  note: "",
  toAccountId: "",
  transactionAt: toLocalDateTimeValue(new Date().toISOString())
};

export function TransfersPage({
  accessToken,
  currentUser,
  message: sessionMessage,
  navigation,
  onLogout
}: TransfersPageProps): React.ReactElement {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState<TransferForm>(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTransferGroupId, setEditingTransferGroupId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TransferForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  useEffect(() => {
    async function loadInitialWorkspace(): Promise<void> {
      setIsLoading(true);
      setMessage(null);

      try {
        const [accountResponse, transferResponse] = await Promise.all([
          listAccounts(accessToken),
          listTransfers(accessToken)
        ]);
        setAccounts(accountResponse.items);
        setTransfers(transferResponse.items);
        setNextCursor(transferResponse.nextCursor);
        setForm((current) => applyDefaultAccounts(current, accountResponse.items));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Gagal memuat transfer.");
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
      const [accountResponse, transferResponse] = await Promise.all([
        listAccounts(accessToken),
        listTransfers(accessToken)
      ]);
      setAccounts(accountResponse.items);
      setTransfers(transferResponse.items);
      setNextCursor(transferResponse.nextCursor);
      setForm((current) => applyDefaultAccounts(current, accountResponse.items));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat transfer.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await createTransfer(accessToken, {
        amount: form.amount.trim(),
        fromAccountId: form.fromAccountId,
        note: form.note.trim() || undefined,
        toAccountId: form.toAccountId,
        transactionAt: toIsoDateTime(form.transactionAt)
      });
      setForm({
        ...applyDefaultAccounts(initialForm, accounts),
        transactionAt: toLocalDateTimeValue(new Date().toISOString())
      });
      await loadWorkspace();
      setMessage("Transfer berhasil dibuat.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuat transfer.");
    } finally {
      setIsSaving(false);
    }
  }

  function beginEdit(transfer: Transfer): void {
    setEditingTransferGroupId(transfer.transferGroupId);
    setEditForm({
      amount: transfer.amount,
      fromAccountId: transfer.fromAccount.id,
      note: transfer.note ?? "",
      toAccountId: transfer.toAccount.id,
      transactionAt: toLocalDateTimeValue(transfer.transactionAt)
    });
    setMessage(null);
  }

  function cancelEdit(): void {
    setEditingTransferGroupId(null);
    setEditForm(null);
  }

  async function handleEditSubmit(
    event: FormEvent<HTMLFormElement>,
    transferGroupId: string
  ): Promise<void> {
    event.preventDefault();

    if (editForm === null) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      await updateTransfer(accessToken, transferGroupId, {
        amount: editForm.amount.trim(),
        fromAccountId: editForm.fromAccountId,
        note: editForm.note.trim(),
        toAccountId: editForm.toAccountId,
        transactionAt: toIsoDateTime(editForm.transactionAt)
      });
      cancelEdit();
      await loadWorkspace();
      setMessage("Transfer berhasil diperbarui.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memperbarui transfer.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(transferGroupId: string): Promise<void> {
    setMessage(null);

    try {
      await deleteTransfer(accessToken, transferGroupId);
      await loadWorkspace();
      setMessage("Transfer berhasil dihapus.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menghapus transfer.");
    }
  }

  async function handleLoadMore(): Promise<void> {
    if (nextCursor === null) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await listTransfers(accessToken, {
        cursor: nextCursor
      });
      setTransfers((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat transfer.");
    } finally {
      setIsLoading(false);
    }
  }

  const canSubmit = accounts.length >= 2 && form.fromAccountId !== form.toAccountId;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Money Tracker</p>
          <h1>Transfers</h1>
          <p className="user-line">{currentUser.displayName} / {currentUser.email}</p>
        </div>
        <div className="topbar-actions">
          <span>{transfers.length} shown</span>
          <button className="secondary-inline-button" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      {navigation}

      <section className="workspace-grid" aria-label="Transfer workspace">
        <form className="tool-panel" onSubmit={(event) => void handleCreate(event)}>
          <div className="panel-heading">
            <h2>Add Transfer</h2>
            <button className="primary-button" disabled={isSaving || !canSubmit} type="submit">
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

          <TransferFields
            accounts={accounts}
            form={form}
            onChange={setForm}
          />

          {message !== null ? <p className="status-line">{message}</p> : null}
          {sessionMessage !== null ? <p className="status-line">{sessionMessage}</p> : null}
        </form>

        <section className="resource-list" aria-label="Transfers">
          {transfers.length === 0 ? (
            <div className="empty-state">
              <h2>No transfers yet</h2>
              <p>Move money between two accounts without counting it as income or expense.</p>
            </div>
          ) : (
            transfers.map((transfer) => (
              <article className="resource-row transaction-row" key={transfer.transferGroupId}>
                {editingTransferGroupId === transfer.transferGroupId && editForm !== null ? (
                  <form
                    className="resource-edit-form transaction-edit-form"
                    onSubmit={(event) => void handleEditSubmit(event, transfer.transferGroupId)}
                  >
                    <TransferFields
                      accounts={accounts}
                      form={editForm}
                      onChange={setEditForm}
                    />
                    <div className="row-actions">
                      <button
                        className="primary-button"
                        disabled={isSaving || editForm.fromAccountId === editForm.toAccountId}
                        type="submit"
                      >
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
                      <h2>{transfer.fromAccount.name} to {transfer.toAccount.name}</h2>
                      <p>{transfer.note ?? "Internal transfer"}</p>
                    </div>
                    <div className="balance-block">
                      <strong>{formatMoney(transfer.amount, transfer.currency)}</strong>
                      <span>{formatTransferDate(transfer.transactionAt)}</span>
                    </div>
                    <div className="row-actions">
                      <button
                        className="secondary-inline-button"
                        onClick={() => beginEdit(transfer)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="danger-button"
                        onClick={() => void handleDelete(transfer.transferGroupId)}
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

function TransferFields({
  accounts,
  form,
  onChange
}: {
  accounts: Account[];
  form: TransferForm;
  onChange: (form: TransferForm) => void;
}): React.ReactElement {
  return (
    <div className="form-grid">
      <label className="field">
        <span>From account</span>
        <select
          onChange={(event) => onChange({ ...form, fromAccountId: event.target.value })}
          required
          value={form.fromAccountId}
        >
          <option value="">Select source</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} / {account.currency}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>To account</span>
        <select
          onChange={(event) => onChange({ ...form, toAccountId: event.target.value })}
          required
          value={form.toAccountId}
        >
          <option value="">Select destination</option>
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

      <label className="field">
        <span>Date</span>
        <input
          onChange={(event) => onChange({ ...form, transactionAt: event.target.value })}
          required
          type="datetime-local"
          value={form.transactionAt}
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

function applyDefaultAccounts(form: TransferForm, accounts: Account[]): TransferForm {
  if (accounts.length < 2) {
    return form;
  }

  const fromAccountId = form.fromAccountId || (accounts[0]?.id ?? "");
  const toAccountId = form.toAccountId && form.toAccountId !== fromAccountId
    ? form.toAccountId
    : accounts.find((account) => account.id !== fromAccountId)?.id ?? "";

  return {
    ...form,
    fromAccountId,
    toAccountId
  };
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

function formatTransferDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
