import { createApiUrl } from "./client";

export type AuthUser = {
  displayName: string;
  email: string;
  id: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type RegisterInput = {
  displayName: string;
  email: string;
  password: string;
};

export type RegisterResponse = {
  status: "created";
  userId: string;
};

export async function login(input: LoginInput): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function register(input: RegisterInput): Promise<RegisterResponse> {
  return request<RegisterResponse>("/auth/register", {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function logout(accessToken: string): Promise<void> {
  await request<{ success: true }>("/auth/logout", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    method: "POST"
  });
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(createApiUrl(path), {
    ...init,
    headers: {
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
