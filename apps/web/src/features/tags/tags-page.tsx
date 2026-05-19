"use client";

import { FormEvent, useEffect, useState } from "react";
import { createTag, deleteTag, listTags, Tag, updateTag } from "../../lib/api/tags";

type TagsPageProps = {
  accessToken: string;
  currentUser: {
    displayName: string;
    email: string;
  };
  message: string | null;
  navigation: React.ReactNode;
  onLogout: () => void;
};

type TagForm = {
  colorToken: string;
  name: string;
};

const initialForm: TagForm = {
  colorToken: "",
  name: ""
};

export function TagsPage({
  accessToken,
  currentUser,
  message: sessionMessage,
  navigation,
  onLogout
}: TagsPageProps): React.ReactElement {
  const [tags, setTags] = useState<Tag[]>([]);
  const [form, setForm] = useState<TagForm>(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TagForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    listTags(accessToken)
      .then((response) => setTags(response.items))
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Gagal memuat tag.");
      })
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  async function loadTags(): Promise<void> {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await listTags(accessToken);
      setTags(response.items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat tag.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const tag = await createTag(accessToken, {
        colorToken: form.colorToken.trim() || undefined,
        name: form.name.trim()
      });
      setTags((current) => sortTags([...current, tag]));
      setForm(initialForm);
      setMessage("Tag berhasil dibuat.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuat tag.");
    } finally {
      setIsSaving(false);
    }
  }

  function beginEdit(tag: Tag): void {
    setEditingTagId(tag.id);
    setEditForm({
      colorToken: tag.colorToken ?? "",
      name: tag.name
    });
    setMessage(null);
  }

  function cancelEdit(): void {
    setEditingTagId(null);
    setEditForm(null);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>, tagId: string): Promise<void> {
    event.preventDefault();

    if (editForm === null) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const updatedTag = await updateTag(accessToken, tagId, {
        colorToken: editForm.colorToken.trim(),
        name: editForm.name.trim()
      });
      setTags((current) =>
        sortTags(current.map((tag) => (tag.id === tagId ? updatedTag : tag)))
      );
      cancelEdit();
      setMessage("Tag berhasil diperbarui.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memperbarui tag.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(tagId: string): Promise<void> {
    setMessage(null);

    try {
      await deleteTag(accessToken, tagId);
      setTags((current) => current.filter((tag) => tag.id !== tagId));
      setMessage("Tag berhasil dihapus.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menghapus tag.");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Money Tracker</p>
          <h1>Tags</h1>
          <p className="user-line">{currentUser.displayName} / {currentUser.email}</p>
        </div>
        <div className="topbar-actions">
          <span>{tags.length} active</span>
          <button className="secondary-inline-button" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      {navigation}

      <section className="workspace-grid" aria-label="Tag workspace">
        <form className="tool-panel" onSubmit={(event) => void handleCreate(event)}>
          <div className="panel-heading">
            <h2>Add Tag</h2>
            <button className="primary-button" disabled={isSaving} type="submit">
              {isSaving ? "Saving" : "Save"}
            </button>
          </div>

          <button
            className="secondary-button"
            disabled={isLoading}
            onClick={() => void loadTags()}
            type="button"
          >
            {isLoading ? "Loading" : "Refresh"}
          </button>

          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input
                maxLength={80}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                value={form.name}
              />
            </label>

            <label className="field">
              <span>Color token</span>
              <input
                maxLength={40}
                onChange={(event) => setForm({ ...form, colorToken: event.target.value })}
                value={form.colorToken}
              />
            </label>
          </div>

          {message !== null ? <p className="status-line">{message}</p> : null}
          {sessionMessage !== null ? <p className="status-line">{sessionMessage}</p> : null}
        </form>

        <section className="resource-list" aria-label="Tags">
          {tags.length === 0 ? (
            <div className="empty-state">
              <h2>No tags yet</h2>
              <p>Create reusable tags for future transaction filtering.</p>
            </div>
          ) : (
            tags.map((tag) => (
              <article className="resource-row tag-row" key={tag.id}>
                {editingTagId === tag.id && editForm !== null ? (
                  <form
                    className="resource-edit-form tag-edit-form"
                    onSubmit={(event) => void handleEditSubmit(event, tag.id)}
                  >
                    <label className="field">
                      <span>Name</span>
                      <input
                        maxLength={80}
                        onChange={(event) =>
                          setEditForm({ ...editForm, name: event.target.value })
                        }
                        required
                        value={editForm.name}
                      />
                    </label>

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
                      <h2>{tag.name}</h2>
                      <p>{tag.colorToken ?? "No color token"}</p>
                    </div>
                    <div className="token-block">
                      <span className="kind-pill">{tag.colorToken ?? "tag"}</span>
                    </div>
                    <div className="row-actions">
                      <button
                        className="secondary-inline-button"
                        onClick={() => beginEdit(tag)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="danger-button"
                        onClick={() => void handleDelete(tag.id)}
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
        </section>
      </section>
    </main>
  );
}

function sortTags(tags: Tag[]): Tag[] {
  return [...tags].sort((a, b) => a.name.localeCompare(b.name));
}
