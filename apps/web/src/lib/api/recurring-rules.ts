import { createApiUrl } from "./client";

export type RecurringFrequency = "daily" | "monthly" | "weekly";
export type RecurringRuleStatus = "active" | "completed" | "paused";
export type RecurringTransactionType = "expense" | "income";

export type RecurringTemplate = {
  accountId: string;
  amount: string;
  categoryId?: string;
  currency: string;
  merchant?: string;
  type: RecurringTransactionType;
};

export type RecurringRule = {
  endAt: string | null;
  frequency: RecurringFrequency;
  id: string;
  intervalCount: number;
  lastGenerationErrorCode: string | null;
  lastRunAt: string | null;
  name: string;
  nextRunAt: string | null;
  pausedAt: string | null;
  startAt: string;
  status: RecurringRuleStatus;
  template: RecurringTemplate;
  timezone: string;
};

export type RecurringRuleListResponse = {
  items: RecurringRule[];
  nextCursor: string | null;
};

export type CreateRecurringRuleInput = {
  endAt?: string;
  frequency: RecurringFrequency;
  intervalCount: number;
  name: string;
  startAt: string;
  template: RecurringTemplate;
};

export type UpdateRecurringRuleInput = Omit<Partial<CreateRecurringRuleInput>, "endAt"> & {
  endAt?: string | null;
};

export async function listRecurringRules(accessToken: string): Promise<RecurringRuleListResponse> {
  return request<RecurringRuleListResponse>("/recurring-rules", accessToken);
}

export async function createRecurringRule(
  accessToken: string,
  input: CreateRecurringRuleInput
): Promise<RecurringRule> {
  return request<RecurringRule>("/recurring-rules", accessToken, {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function updateRecurringRule(
  accessToken: string,
  ruleId: string,
  input: UpdateRecurringRuleInput
): Promise<RecurringRule> {
  return request<RecurringRule>(`/recurring-rules/${ruleId}`, accessToken, {
    body: JSON.stringify(input),
    method: "PATCH"
  });
}

export async function archiveRecurringRule(accessToken: string, ruleId: string): Promise<void> {
  await request<{ mode: "archived"; success: true }>(`/recurring-rules/${ruleId}`, accessToken, {
    method: "DELETE"
  });
}

export async function pauseRecurringRule(
  accessToken: string,
  ruleId: string
): Promise<RecurringRule> {
  return request<RecurringRule>(`/recurring-rules/${ruleId}/pause`, accessToken, {
    method: "POST"
  });
}

export async function resumeRecurringRule(
  accessToken: string,
  ruleId: string
): Promise<RecurringRule> {
  return request<RecurringRule>(`/recurring-rules/${ruleId}/resume`, accessToken, {
    method: "POST"
  });
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
