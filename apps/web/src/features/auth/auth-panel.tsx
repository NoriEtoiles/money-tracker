"use client";

import { FormEvent, useState } from "react";
import { login, LoginResponse, register } from "../../lib/api/auth";

type AuthPanelProps = {
  onAuthenticated: (session: LoginResponse) => void;
};

type AuthMode = "login" | "register";

const initialForm = {
  displayName: "",
  email: "",
  password: ""
};

export function AuthPanel({ onAuthenticated }: AuthPanelProps): React.ReactElement {
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      if (mode === "register") {
        await register({
          displayName: form.displayName.trim(),
          email: form.email.trim(),
          password: form.password
        });
      }

      const session = await login({
        email: form.email.trim(),
        password: form.password
      });
      setForm(initialForm);
      onAuthenticated(session);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Auth request failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="tool-panel auth-panel" onSubmit={(event) => void handleSubmit(event)}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Secure access</p>
          <h2>{mode === "login" ? "Login" : "Create account"}</h2>
        </div>
        <div className="segmented-control" role="group" aria-label="Auth mode">
          <button
            className={mode === "login" ? "segment-active" : ""}
            onClick={() => setMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={mode === "register" ? "segment-active" : ""}
            onClick={() => setMode("register")}
            type="button"
          >
            Register
          </button>
        </div>
      </div>

      {mode === "register" ? (
        <label className="field">
          <span>Display name</span>
          <input
            autoComplete="name"
            maxLength={120}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            required
            value={form.displayName}
          />
        </label>
      ) : null}

      <label className="field">
        <span>Email</span>
        <input
          autoComplete="email"
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
          type="email"
          value={form.email}
        />
      </label>

      <label className="field">
        <span>Password</span>
        <input
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={8}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          required
          type="password"
          value={form.password}
        />
      </label>

      <button className="primary-button full-width-button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Working" : mode === "login" ? "Login" : "Register"}
      </button>

      {message !== null ? <p className="status-line">{message}</p> : null}
    </form>
  );
}
