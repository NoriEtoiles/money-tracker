"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  archiveCategory,
  Category,
  CategoryKind,
  createCategory,
  listCategories,
  updateCategory
} from "../../lib/api/categories";
import { CategorySelector } from "./category-selector";

type CategoriesPageProps = {
  accessToken: string;
  currentUser: {
    displayName: string;
    email: string;
  };
  message: string | null;
  navigation: React.ReactNode;
  onLogout: () => void;
};

type CategoryForm = {
  colorToken: string;
  iconToken: string;
  kind: CategoryKind;
  name: string;
  parentId: string;
  sortOrder: number;
};

type EditForm = {
  colorToken: string;
  iconToken: string;
  name: string;
  parentId: string;
  sortOrder: number;
};

const initialForm: CategoryForm = {
  colorToken: "",
  iconToken: "",
  kind: "expense",
  name: "",
  parentId: "",
  sortOrder: 0
};

export function CategoriesPage({
  accessToken,
  currentUser,
  message: sessionMessage,
  navigation,
  onLogout
}: CategoriesPageProps): React.ReactElement {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryForm>(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    listCategories(accessToken)
      .then((response) => setCategories(response.items))
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Gagal memuat kategori.");
      })
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  async function loadCategories(): Promise<void> {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await listCategories(accessToken);
      setCategories(response.items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat kategori.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const category = await createCategory(accessToken, {
        colorToken: form.colorToken.trim() || undefined,
        iconToken: form.iconToken.trim() || undefined,
        kind: form.kind,
        name: form.name.trim(),
        parentId: form.parentId || undefined,
        sortOrder: form.sortOrder
      });
      setCategories((current) => sortCategories([...current, category]));
      setForm(initialForm);
      setMessage("Kategori berhasil dibuat.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuat kategori.");
    } finally {
      setIsSaving(false);
    }
  }

  function beginEdit(category: Category): void {
    setEditingCategoryId(category.id);
    setEditForm({
      colorToken: category.colorToken ?? "",
      iconToken: category.iconToken ?? "",
      name: category.name,
      parentId: category.parentId ?? "",
      sortOrder: category.sortOrder
    });
    setMessage(null);
  }

  function cancelEdit(): void {
    setEditingCategoryId(null);
    setEditForm(null);
  }

  async function handleEditSubmit(
    event: FormEvent<HTMLFormElement>,
    category: Category
  ): Promise<void> {
    event.preventDefault();

    if (editForm === null) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const updatedCategory = await updateCategory(accessToken, category.id, {
        colorToken: editForm.colorToken.trim(),
        iconToken: editForm.iconToken.trim(),
        name: editForm.name.trim(),
        parentId: editForm.parentId || undefined,
        sortOrder: editForm.sortOrder
      });
      setCategories((current) =>
        sortCategories(
          current.map((currentCategory) =>
            currentCategory.id === category.id ? updatedCategory : currentCategory
          )
        )
      );
      cancelEdit();
      setMessage("Kategori berhasil diperbarui.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memperbarui kategori.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive(categoryId: string): Promise<void> {
    setMessage(null);

    try {
      await archiveCategory(accessToken, categoryId);
      setCategories((current) => current.filter((category) => category.id !== categoryId));
      setMessage("Kategori berhasil diarsipkan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengarsipkan kategori.");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Money Tracker</p>
          <h1>Categories</h1>
          <p className="user-line">{currentUser.displayName} / {currentUser.email}</p>
        </div>
        <div className="topbar-actions">
          <span>{categories.length} active</span>
          <button className="secondary-inline-button" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      {navigation}

      <section className="workspace-grid" aria-label="Category workspace">
        <form className="tool-panel" onSubmit={(event) => void handleCreate(event)}>
          <div className="panel-heading">
            <h2>Add Category</h2>
            <button className="primary-button" disabled={isSaving} type="submit">
              {isSaving ? "Saving" : "Save"}
            </button>
          </div>

          <button
            className="secondary-button"
            disabled={isLoading}
            onClick={() => void loadCategories()}
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
              <span>Kind</span>
              <select
                onChange={(event) =>
                  setForm({
                    ...form,
                    kind: event.target.value as CategoryKind,
                    parentId: ""
                  })
                }
                value={form.kind}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>

            <CategorySelector
              categories={categories}
              kind={form.kind}
              label="Parent category"
              onChange={(parentId) => setForm({ ...form, parentId })}
              placeholder="No parent"
              value={form.parentId}
            />

            <label className="field">
              <span>Color token</span>
              <input
                maxLength={40}
                onChange={(event) => setForm({ ...form, colorToken: event.target.value })}
                value={form.colorToken}
              />
            </label>

            <label className="field">
              <span>Icon token</span>
              <input
                maxLength={40}
                onChange={(event) => setForm({ ...form, iconToken: event.target.value })}
                value={form.iconToken}
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

          {message !== null ? <p className="status-line">{message}</p> : null}
          {sessionMessage !== null ? <p className="status-line">{sessionMessage}</p> : null}
        </form>

        <section className="resource-list" aria-label="Categories">
          {categories.length === 0 ? (
            <div className="empty-state">
              <h2>No categories yet</h2>
              <p>Seed defaults during onboarding or create income and expense categories here.</p>
            </div>
          ) : (
            categories.map((category) => (
              <article className="resource-row" key={category.id}>
                {editingCategoryId === category.id && editForm !== null ? (
                  <form
                    className="resource-edit-form"
                    onSubmit={(event) => void handleEditSubmit(event, category)}
                  >
                    <label className="field">
                      <span>Name</span>
                      <input
                        maxLength={120}
                        onChange={(event) =>
                          setEditForm({ ...editForm, name: event.target.value })
                        }
                        required
                        value={editForm.name}
                      />
                    </label>

                    <CategorySelector
                      categories={categories.filter(
                        (parentCategory) => parentCategory.id !== category.id
                      )}
                      kind={category.kind}
                      label="Parent category"
                      onChange={(parentId) => setEditForm({ ...editForm, parentId })}
                      placeholder="No parent"
                      value={editForm.parentId}
                    />

                    <label className="field">
                      <span>Color token</span>
                      <input
                        maxLength={40}
                        onChange={(event) =>
                          setEditForm({ ...editForm, colorToken: event.target.value })
                        }
                        value={editForm.colorToken}
                      />
                    </label>

                    <label className="field">
                      <span>Icon token</span>
                      <input
                        maxLength={40}
                        onChange={(event) =>
                          setEditForm({ ...editForm, iconToken: event.target.value })
                        }
                        value={editForm.iconToken}
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
                      <h2>{category.name}</h2>
                      <p>
                        {formatKind(category.kind)}
                        {category.parentId ? ` / child category` : ""}
                      </p>
                    </div>
                    <div className="token-block">
                      <span className="kind-pill">{formatKind(category.kind)}</span>
                      <small>{formatTokens(category)}</small>
                    </div>
                    <div className="row-actions">
                      <button
                        className="secondary-inline-button"
                        onClick={() => beginEdit(category)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="danger-button"
                        onClick={() => void handleArchive(category.id)}
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

function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind.localeCompare(b.kind);
    }

    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }

    return a.name.localeCompare(b.name);
  });
}

function formatKind(kind: CategoryKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function formatTokens(category: Category): string {
  const tokens = [category.colorToken, category.iconToken].filter(Boolean);

  return tokens.length > 0 ? tokens.join(" / ") : `Sort ${category.sortOrder}`;
}
