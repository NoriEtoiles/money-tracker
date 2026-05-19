import { createApiUrl } from "./client";

export type CategoryKind = "expense" | "income";

export type Category = {
  archivedAt: string | null;
  colorToken: string | null;
  iconToken: string | null;
  id: string;
  kind: CategoryKind;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

export type CategoryListResponse = {
  items: Category[];
};

export type CreateCategoryInput = {
  colorToken?: string;
  iconToken?: string;
  kind: CategoryKind;
  name: string;
  parentId?: string;
  sortOrder?: number;
};

export type UpdateCategoryInput = {
  colorToken?: string;
  iconToken?: string;
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
};

export async function listCategories(accessToken: string): Promise<CategoryListResponse> {
  return request<CategoryListResponse>("/categories", accessToken);
}

export async function createCategory(
  accessToken: string,
  input: CreateCategoryInput
): Promise<Category> {
  return request<Category>("/categories", accessToken, {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function updateCategory(
  accessToken: string,
  categoryId: string,
  input: UpdateCategoryInput
): Promise<Category> {
  return request<Category>(`/categories/${categoryId}`, accessToken, {
    body: JSON.stringify(input),
    method: "PATCH"
  });
}

export async function archiveCategory(accessToken: string, categoryId: string): Promise<void> {
  await request<{ mode: "archived"; success: true }>(`/categories/${categoryId}`, accessToken, {
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
