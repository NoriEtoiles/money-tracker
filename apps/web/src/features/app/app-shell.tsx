"use client";

import { useEffect, useState } from "react";
import { logout, LoginResponse } from "../../lib/api/auth";
import { AccountsPage } from "../accounts/accounts-page";
import { AuthPanel } from "../auth/auth-panel";
import { BudgetsPage } from "../budgets/budgets-page";
import { CategoriesPage } from "../categories/categories-page";
import { DashboardPage } from "../dashboard/dashboard-page";
import { ReportsPage } from "../reports/reports-page";
import { RecurringPage } from "../recurring/recurring-page";
import { TagsPage } from "../tags/tags-page";
import { TransactionsPage } from "../transactions/transactions-page";
import { TransfersPage } from "../transfers/transfers-page";

type SessionState = {
  accessToken: string;
  displayName: string;
  email: string;
  refreshToken: string;
};

type AppTab =
  | "accounts"
  | "budgets"
  | "categories"
  | "dashboard"
  | "reports"
  | "recurring"
  | "tags"
  | "transactions"
  | "transfers";

const accessTokenKey = "money-tracker-access-token";
const refreshTokenKey = "money-tracker-refresh-token";
const displayNameKey = "money-tracker-display-name";
const emailKey = "money-tracker-email";

const appTabs: Array<{ label: string; value: AppTab }> = [
  { label: "Dashboard", value: "dashboard" },
  { label: "Accounts", value: "accounts" },
  { label: "Transactions", value: "transactions" },
  { label: "Transfers", value: "transfers" },
  { label: "Budgets", value: "budgets" },
  { label: "Reports", value: "reports" },
  { label: "Recurring", value: "recurring" },
  { label: "Categories", value: "categories" },
  { label: "Tags", value: "tags" }
];

export function AppShell(): React.ReactElement {
  const [session, setSession] = useState<SessionState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("dashboard");

  useEffect(() => {
    const accessToken = window.localStorage.getItem(accessTokenKey);
    const refreshToken = window.localStorage.getItem(refreshTokenKey);
    const displayName = window.localStorage.getItem(displayNameKey);
    const email = window.localStorage.getItem(emailKey);

    if (accessToken !== null && refreshToken !== null && displayName !== null && email !== null) {
      setSession({
        accessToken,
        displayName,
        email,
        refreshToken
      });
    }
  }, []);

  function handleAuthenticated(response: LoginResponse): void {
    const nextSession = {
      accessToken: response.accessToken,
      displayName: response.user.displayName,
      email: response.user.email,
      refreshToken: response.refreshToken
    };

    window.localStorage.setItem(accessTokenKey, nextSession.accessToken);
    window.localStorage.setItem(refreshTokenKey, nextSession.refreshToken);
    window.localStorage.setItem(displayNameKey, nextSession.displayName);
    window.localStorage.setItem(emailKey, nextSession.email);
    setSession(nextSession);
    setMessage(null);
  }

  async function handleLogout(): Promise<void> {
    if (session === null) {
      return;
    }

    try {
      await logout(session.accessToken);
    } catch {
      setMessage("Local session cleared. Server logout may have already expired.");
    } finally {
      window.localStorage.removeItem(accessTokenKey);
      window.localStorage.removeItem(refreshTokenKey);
      window.localStorage.removeItem(displayNameKey);
      window.localStorage.removeItem(emailKey);
      setSession(null);
    }
  }

  if (session === null) {
    return (
      <main className="app-shell auth-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Money Tracker</p>
            <h1>Start tracking accounts</h1>
          </div>
        </header>
        <AuthPanel onAuthenticated={handleAuthenticated} />
      </main>
    );
  }

  const currentUser = {
    displayName: session.displayName,
    email: session.email
  };
  const navigation = (
    <nav className="app-tabs" aria-label="Primary">
      {appTabs.map((tab) => (
        <button
          className={activeTab === tab.value ? "app-tab app-tab-active" : "app-tab"}
          key={tab.value}
          onClick={() => setActiveTab(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );

  if (activeTab === "dashboard") {
    return (
      <DashboardPage
        accessToken={session.accessToken}
        currentUser={currentUser}
        message={message}
        navigation={navigation}
        onLogout={() => void handleLogout()}
      />
    );
  }

  if (activeTab === "categories") {
    return (
      <CategoriesPage
        accessToken={session.accessToken}
        currentUser={currentUser}
        message={message}
        navigation={navigation}
        onLogout={() => void handleLogout()}
      />
    );
  }

  if (activeTab === "tags") {
    return (
      <TagsPage
        accessToken={session.accessToken}
        currentUser={currentUser}
        message={message}
        navigation={navigation}
        onLogout={() => void handleLogout()}
      />
    );
  }

  if (activeTab === "transactions") {
    return (
      <TransactionsPage
        accessToken={session.accessToken}
        currentUser={currentUser}
        message={message}
        navigation={navigation}
        onLogout={() => void handleLogout()}
      />
    );
  }

  if (activeTab === "transfers") {
    return (
      <TransfersPage
        accessToken={session.accessToken}
        currentUser={currentUser}
        message={message}
        navigation={navigation}
        onLogout={() => void handleLogout()}
      />
    );
  }

  if (activeTab === "budgets") {
    return (
      <BudgetsPage
        accessToken={session.accessToken}
        currentUser={currentUser}
        message={message}
        navigation={navigation}
        onLogout={() => void handleLogout()}
      />
    );
  }

  if (activeTab === "reports") {
    return (
      <ReportsPage
        accessToken={session.accessToken}
        currentUser={currentUser}
        message={message}
        navigation={navigation}
        onLogout={() => void handleLogout()}
      />
    );
  }

  if (activeTab === "recurring") {
    return (
      <RecurringPage
        accessToken={session.accessToken}
        currentUser={currentUser}
        message={message}
        navigation={navigation}
        onLogout={() => void handleLogout()}
      />
    );
  }

  return (
    <AccountsPage
      accessToken={session.accessToken}
      currentUser={currentUser}
      message={message}
      navigation={navigation}
      onLogout={() => void handleLogout()}
    />
  );
}
