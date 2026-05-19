import { createApiUrl } from "./client";

export type Tag = {
  colorToken: string | null;
  id: string;
  name: string;
};

export type TagListResponse = {
  items: Tag[];
};

export type CreateTagInput = {
  colorToken?: string;
  name: string;
};

export type UpdateTagInput = {
  colorToken?: string;
  name?: string;
};

export async function listTags(accessToken: string): Promise<TagListResponse> {
  return request<TagListResponse>("/tags", accessToken);
}

export async function createTag(accessToken: string, input: CreateTagInput): Promise<Tag> {
  return request<Tag>("/tags", accessToken, {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function updateTag(
  accessToken: string,
  tagId: string,
  input: UpdateTagInput
): Promise<Tag> {
  return request<Tag>(`/tags/${tagId}`, accessToken, {
    body: JSON.stringify(input),
    method: "PATCH"
  });
}

export async function deleteTag(accessToken: string, tagId: string): Promise<void> {
  await request<{ success: true }>(`/tags/${tagId}`, accessToken, {
    method: "DELETE"
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
