import { createApiUrl } from "./client";

export type CurrentUserProfile = {
  defaultCurrency: string;
  displayName: string;
  email: string;
  id: string;
  locale: string;
  timezone: string;
};

export type UpdateProfileInput = Partial<Pick<
  CurrentUserProfile,
  "defaultCurrency" | "displayName" | "locale" | "timezone"
>>;

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type AuthSession = {
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
  sessionId: string;
  userAgent: string | null;
};

export type SessionListResponse = {
  items: AuthSession[];
};

export type RevokeSessionsResponse = {
  revokedCount: number;
  success: true;
};

export type AccountDeletionRequest = {
  requestedAt: string;
  status: string;
};

export type AccountDeletionRequestStatusResponse = {
  request: AccountDeletionRequest | null;
};

export type RequestAccountDeletionInput = {
  confirmationPhrase: string;
  currentPassword: string;
};

export type AuditEventItem = {
  createdAt: string;
  entityType: string | null;
  eventType: string;
  metadata: Record<string, unknown>;
};

export type AuditEventListResponse = {
  items: AuditEventItem[];
  nextCursor: string | null;
};

export function getProfile(accessToken: string): Promise<CurrentUserProfile> {
  return request<CurrentUserProfile>("/me", accessToken);
}

export function updateProfile(
  accessToken: string,
  input: UpdateProfileInput
): Promise<CurrentUserProfile> {
  return request<CurrentUserProfile>("/me", accessToken, {
    body: JSON.stringify(input),
    method: "PATCH"
  });
}

export function changePassword(
  accessToken: string,
  input: ChangePasswordInput
): Promise<RevokeSessionsResponse> {
  return request<RevokeSessionsResponse>("/auth/change-password", accessToken, {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export function listSessions(accessToken: string): Promise<SessionListResponse> {
  return request<SessionListResponse>("/auth/sessions", accessToken);
}

export function revokeSession(
  accessToken: string,
  sessionId: string
): Promise<RevokeSessionsResponse> {
  return request<RevokeSessionsResponse>(`/auth/sessions/${sessionId}/revoke`, accessToken, {
    method: "POST"
  });
}

export function revokeOtherSessions(accessToken: string): Promise<RevokeSessionsResponse> {
  return request<RevokeSessionsResponse>("/auth/sessions/revoke-others", accessToken, {
    method: "POST"
  });
}

export function getDeletionRequest(
  accessToken: string
): Promise<AccountDeletionRequestStatusResponse> {
  return request<AccountDeletionRequestStatusResponse>("/me/deletion-request", accessToken);
}

export function requestAccountDeletion(
  accessToken: string,
  input: RequestAccountDeletionInput
): Promise<AccountDeletionRequestStatusResponse> {
  return request<AccountDeletionRequestStatusResponse>("/me/deletion-request", accessToken, {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export function listAuditEvents(
  accessToken: string,
  cursor?: string
): Promise<AuditEventListResponse> {
  const query = cursor === undefined ? "" : `?cursor=${encodeURIComponent(cursor)}`;

  return request<AuditEventListResponse>(`/audit-events${query}`, accessToken);
}

async function request<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(createApiUrl(path), {
    ...init,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function getErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const body = await response.json() as { error?: { message?: string } };

    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}
