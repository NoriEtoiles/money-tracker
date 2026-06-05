"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AccountDeletionRequest,
  AuditEventItem,
  AuthSession,
  changePassword,
  CurrentUserProfile,
  getDeletionRequest,
  getProfile,
  listAuditEvents,
  listSessions,
  requestAccountDeletion,
  revokeOtherSessions,
  revokeSession,
  updateProfile
} from "../../lib/api/settings";

type SettingsPageProps = {
  accessToken: string;
  currentUser: {
    displayName: string;
    email: string;
  };
  message: string | null;
  navigation: React.ReactNode;
  onLogout: () => void;
  onOpenExport: () => void;
  onProfileUpdated: (profile: CurrentUserProfile) => void;
};

type ProfileForm = {
  defaultCurrency: string;
  displayName: string;
  locale: string;
  timezone: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
};

type DeleteForm = {
  confirmationPhrase: string;
  currentPassword: string;
};

const emptyProfileForm: ProfileForm = {
  defaultCurrency: "",
  displayName: "",
  locale: "",
  timezone: ""
};

const emptyPasswordForm: PasswordForm = {
  currentPassword: "",
  newPassword: ""
};

const emptyDeleteForm: DeleteForm = {
  confirmationPhrase: "",
  currentPassword: ""
};

export function SettingsPage({
  accessToken,
  currentUser,
  message: sessionMessage,
  navigation,
  onLogout,
  onOpenExport,
  onProfileUpdated
}: SettingsPageProps): React.ReactElement {
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [auditNextCursor, setAuditNextCursor] = useState<string | null>(null);
  const [deletionRequest, setDeletionRequest] = useState<AccountDeletionRequest | null>(null);
  const [isAuditLoadingMore, setIsAuditLoadingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingDelete, setIsSavingDelete] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [deleteForm, setDeleteForm] = useState<DeleteForm>(emptyDeleteForm);
  const [sessions, setSessions] = useState<AuthSession[]>([]);

  const loadSettings = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setMessage(null);

    try {
      const [profile, sessionResponse, deletionResponse, auditResponse] = await Promise.all([
        getProfile(accessToken),
        listSessions(accessToken),
        getDeletionRequest(accessToken),
        listAuditEvents(accessToken)
      ]);

      setProfileForm({
        defaultCurrency: profile.defaultCurrency,
        displayName: profile.displayName,
        locale: profile.locale,
        timezone: profile.timezone
      });
      setSessions(sessionResponse.items);
      setDeletionRequest(deletionResponse.request);
      setAuditEvents(auditResponse.items);
      setAuditNextCursor(auditResponse.nextCursor);
      onProfileUpdated(profile);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat Settings.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, onProfileUpdated]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSavingProfile(true);
    setMessage(null);

    try {
      const profile = await updateProfile(accessToken, {
        defaultCurrency: profileForm.defaultCurrency.trim().toUpperCase(),
        displayName: profileForm.displayName.trim(),
        locale: profileForm.locale.trim(),
        timezone: profileForm.timezone.trim()
      });

      setProfileForm({
        defaultCurrency: profile.defaultCurrency,
        displayName: profile.displayName,
        locale: profile.locale,
        timezone: profile.timezone
      });
      onProfileUpdated(profile);
      await reloadAuditEvents();
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSavingPassword(true);
    setMessage(null);

    try {
      const result = await changePassword(accessToken, passwordForm);

      setPasswordForm(emptyPasswordForm);
      await reloadSessions();
      await reloadAuditEvents();
      setMessage(`Password updated. ${result.revokedCount} other sessions revoked.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengganti password.");
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handleRevokeSession(sessionId: string): Promise<void> {
    setMessage(null);

    try {
      const result = await revokeSession(accessToken, sessionId);

      await reloadSessions();
      await reloadAuditEvents();
      setMessage(`${result.revokedCount} session revoked.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal revoke session.");
    }
  }

  async function handleRevokeOthers(): Promise<void> {
    setMessage(null);

    try {
      const result = await revokeOtherSessions(accessToken);

      await reloadSessions();
      await reloadAuditEvents();
      setMessage(`${result.revokedCount} other sessions revoked.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal revoke sessions.");
    }
  }

  async function handleDeleteRequestSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSavingDelete(true);
    setMessage(null);

    try {
      const response = await requestAccountDeletion(accessToken, deleteForm);

      setDeletionRequest(response.request);
      setDeleteForm(emptyDeleteForm);
      await reloadAuditEvents();
      setMessage("Delete account request recorded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuat delete request.");
    } finally {
      setIsSavingDelete(false);
    }
  }

  async function handleLoadMoreAudit(): Promise<void> {
    if (auditNextCursor === null) {
      return;
    }

    setIsAuditLoadingMore(true);
    setMessage(null);

    try {
      const response = await listAuditEvents(accessToken, auditNextCursor);

      setAuditEvents([...auditEvents, ...response.items]);
      setAuditNextCursor(response.nextCursor);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat audit log.");
    } finally {
      setIsAuditLoadingMore(false);
    }
  }

  async function reloadSessions(): Promise<void> {
    const response = await listSessions(accessToken);

    setSessions(response.items);
  }

  async function reloadAuditEvents(): Promise<void> {
    const response = await listAuditEvents(accessToken);

    setAuditEvents(response.items);
    setAuditNextCursor(response.nextCursor);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Money Tracker</p>
          <h1>Settings & Privacy</h1>
          <p className="user-line">{currentUser.displayName} / {currentUser.email}</p>
        </div>
        <div className="topbar-actions">
          <span>{sessions.length} sessions</span>
          <button className="secondary-inline-button" disabled={isLoading} onClick={() => void loadSettings()} type="button">
            {isLoading ? "Loading" : "Refresh"}
          </button>
          <button className="secondary-inline-button" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      {navigation}

      <section className="settings-layout">
        <section className="tool-panel">
          <div className="panel-heading">
            <h2>Profile</h2>
            <span>Account</span>
          </div>
          <form className="resource-edit-form settings-profile-form" onSubmit={(event) => void handleProfileSubmit(event)}>
            <label className="field">
              <span>Display name</span>
              <input
                maxLength={120}
                onChange={(event) => setProfileForm({ ...profileForm, displayName: event.target.value })}
                required
                value={profileForm.displayName}
              />
            </label>
            <label className="field">
              <span>Default currency</span>
              <input
                maxLength={3}
                onChange={(event) => setProfileForm({ ...profileForm, defaultCurrency: event.target.value })}
                required
                value={profileForm.defaultCurrency}
              />
            </label>
            <label className="field">
              <span>Locale</span>
              <input
                maxLength={20}
                onChange={(event) => setProfileForm({ ...profileForm, locale: event.target.value })}
                required
                value={profileForm.locale}
              />
            </label>
            <label className="field">
              <span>Timezone</span>
              <input
                maxLength={80}
                onChange={(event) => setProfileForm({ ...profileForm, timezone: event.target.value })}
                required
                value={profileForm.timezone}
              />
            </label>
            <button className="primary-button" disabled={isSavingProfile} type="submit">
              {isSavingProfile ? "Saving" : "Save Profile"}
            </button>
          </form>
        </section>

        <section className="tool-panel">
          <div className="panel-heading">
            <h2>Data Export</h2>
            <span>CSV</span>
          </div>
          <p className="helper-line">
            Use the existing export flow for transaction CSV downloads.
          </p>
          <button className="primary-button full-width-button" onClick={onOpenExport} type="button">
            Open Export
          </button>
        </section>

        <section className="tool-panel">
          <div className="panel-heading">
            <h2>Security</h2>
            <button className="secondary-inline-button" onClick={() => void handleRevokeOthers()} type="button">
              Revoke Others
            </button>
          </div>
          <form className="resource-edit-form settings-password-form" onSubmit={(event) => void handlePasswordSubmit(event)}>
            <label className="field">
              <span>Current password</span>
              <input
                autoComplete="current-password"
                minLength={8}
                onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                required
                type="password"
                value={passwordForm.currentPassword}
              />
            </label>
            <label className="field">
              <span>New password</span>
              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                required
                type="password"
                value={passwordForm.newPassword}
              />
            </label>
            <button className="primary-button" disabled={isSavingPassword} type="submit">
              {isSavingPassword ? "Updating" : "Change Password"}
            </button>
          </form>

          <div className="settings-list">
            {sessions.length === 0 ? (
              <div className="empty-state">
                <p>No active sessions found.</p>
              </div>
            ) : sessions.map((session) => (
              <article className="session-row" key={session.sessionId}>
                <div>
                  <strong>{session.isCurrent ? "Current session" : "Other session"}</strong>
                  <p>{session.userAgent ?? "Unknown browser"}</p>
                  <p>{formatDate(session.createdAt)} / expires {formatDate(session.expiresAt)}</p>
                </div>
                <button
                  className="danger-button"
                  disabled={session.isCurrent}
                  onClick={() => void handleRevokeSession(session.sessionId)}
                  type="button"
                >
                  Revoke
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="tool-panel">
          <div className="panel-heading">
            <h2>Delete Account</h2>
            <span>{deletionRequest?.status ?? "Not requested"}</span>
          </div>
          {deletionRequest !== null ? (
            <div className="empty-state">
              <p>Delete request pending since {formatDate(deletionRequest.requestedAt)}.</p>
            </div>
          ) : (
            <form className="form-grid" onSubmit={(event) => void handleDeleteRequestSubmit(event)}>
              <label className="field">
                <span>Current password</span>
                <input
                  autoComplete="current-password"
                  minLength={8}
                  onChange={(event) => setDeleteForm({ ...deleteForm, currentPassword: event.target.value })}
                  required
                  type="password"
                  value={deleteForm.currentPassword}
                />
              </label>
              <label className="field">
                <span>Type DELETE MY ACCOUNT</span>
                <input
                  onChange={(event) => setDeleteForm({ ...deleteForm, confirmationPhrase: event.target.value })}
                  required
                  value={deleteForm.confirmationPhrase}
                />
              </label>
              <button className="danger-button full-width-button" disabled={isSavingDelete} type="submit">
                {isSavingDelete ? "Requesting" : "Request Delete"}
              </button>
            </form>
          )}
        </section>
      </section>

      <section className="tool-panel settings-audit-panel">
        <div className="panel-heading">
          <h2>Audit Log</h2>
          <span>{auditEvents.length} events</span>
        </div>
        {auditEvents.length === 0 ? (
          <div className="empty-state">
            <p>No audit events yet.</p>
          </div>
        ) : (
          <div className="settings-list">
            {auditEvents.map((event, index) => (
              <article className="audit-row" key={`${event.createdAt}-${event.eventType}-${index}`}>
                <div>
                  <strong>{event.eventType}</strong>
                  <p>{event.entityType ?? "system"} / {formatDate(event.createdAt)}</p>
                </div>
                <p className="audit-metadata">{formatMetadata(event.metadata)}</p>
              </article>
            ))}
          </div>
        )}
        {auditNextCursor !== null ? (
          <button
            className="secondary-button"
            disabled={isAuditLoadingMore}
            onClick={() => void handleLoadMoreAudit()}
            type="button"
          >
            {isAuditLoadingMore ? "Loading" : "Load More"}
          </button>
        ) : null}
      </section>

      {message !== null ? <p className="status-line">{message}</p> : null}
      {sessionMessage !== null ? <p className="status-line">{sessionMessage}</p> : null}
    </main>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("id-ID");
}

function formatMetadata(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata);

  if (entries.length === 0) {
    return "No public metadata";
  }

  return entries
    .map(([key, value]) => `${key}: ${formatMetadataValue(value)}`)
    .join(" / ");
}

function formatMetadataValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}
