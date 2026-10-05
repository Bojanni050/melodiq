"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import { useSidebarStore, useUserStore } from "@/lib/store";
import { useT } from "@/hooks/useT";
import { ARTIST_PAGE_BIO_MAX_LENGTH } from "@/lib/artist-pages";

interface ArtistPageRow {
  id: string;
  alias: string;
  slug: string;
  bio: string | null;
  imageS3Key: string | null;
  heroS3Key: string | null;
}

/** Per-page form state, kept apart from the server rows so typing stays local. */
interface Draft {
  bio: string;
  slug: string;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-ink-dim mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-ink-dim mt-1.5">{hint}</p>}
    </div>
  );
}

export default function ArtistPagesPage() {
  const t = useT();
  const router = useRouter();
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const user = useUserStore((s) => s.user);
  const isListener = user?.role === "listener" || user?.role == null;

  const [pages, setPages] = useState<ArtistPageRow[]>([]);
  const [availableAliases, setAvailableAliases] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [flashId, setFlashId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/artist-pages");
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (res.ok) {
      const data = await res.json();
      const rows: ArtistPageRow[] = data.pages ?? [];
      setPages(rows);
      setAvailableAliases(data.availableAliases ?? []);
      setDrafts(
        Object.fromEntries(rows.map((row) => [row.id, { bio: row.bio ?? "", slug: row.slug }]))
      );
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function setDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function flash(id: string) {
    setFlashId(id);
    setTimeout(() => setFlashId((current) => (current === id ? null : current)), 2000);
  }

  async function handleCreate(alias: string) {
    setCreating(alias);
    setMessage("");
    setError("");
    const res = await fetch("/api/artist-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias }),
    });
    if (res.ok) {
      setMessage(t("artistPages.created"));
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t("artistPages.createFailed"));
    }
    setCreating(null);
  }

  async function handleSave(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    setMessage("");
    setError("");
    const res = await fetch(`/api/artist-pages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: draft.bio, slug: draft.slug }),
    });
    if (res.ok) {
      const data = await res.json();
      setPages((prev) => prev.map((row) => (row.id === id ? { ...row, ...data.page } : row)));
      setMessage(t("artistPages.saved"));
      flash(id);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t("artistPages.saveFailed"));
    }
    setSavingId(null);
  }

  async function handleDelete(id: string, alias: string) {
    if (!window.confirm(t("artistPages.deleteConfirm", { name: alias }))) return;
    setMessage("");
    setError("");
    const res = await fetch(`/api/artist-pages/${id}`, { method: "DELETE" });
    if (res.ok) {
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t("artistPages.deleteFailed"));
    }
  }

  async function handleImage(id: string, type: "profile" | "hero", file: File) {
    setUploading(`${id}:${type}`);
    setMessage("");
    setError("");
    const fd = new FormData();
    fd.append("type", type);
    fd.append("file", file);
    const res = await fetch(`/api/artist-pages/${id}/image`, { method: "POST", body: fd });
    if (res.ok) {
      // Re-read instead of trusting the local flag: the image URL is derived
      // from the slug server-side, so the row has to come back with the key.
      await load();
      setMessage(t("account.imageUploaded"));
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t("account.uploadFailed"));
    }
    setUploading(null);
  }

  return (
    <div className="h-screen bg-canvas overflow-hidden text-ink">
      <Sidebar credits={null} />

      <div
        className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] flex"
        style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}
      >
        <main
          className={`flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 ${isListener ? "lg:pt-20" : "lg:pt-5"}`}
        >
          <div className="max-w-400 mx-auto space-y-6">
            <section className="px-1 py-2 sm:px-2">
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.28em] text-ink-dim">{t("artistPages.tagline")}</p>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{t("artistPages.title")}</h1>
              </div>
            </section>

            {message && <div className=" border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</div>}
            {error && <div className=" border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}

            <section className="space-y-4">
              <h2 className="text-xs font-medium uppercase tracking-wider text-ink-dim">{t("artistPages.pagesHeading")}</h2>
              <p className="text-xs text-ink-dim -mt-2">{t("artistPages.tracksHint")}</p>

              {loading ? (
                <div className=" border border-line bg-white/5 p-8 text-sm text-ink-muted">{t("artistPages.loading")}</div>
              ) : pages.length === 0 ? (
                <div className=" border border-dashed border-line bg-white/3 p-8 text-sm text-ink/55">
                  {t("artistPages.noneYet")}
                </div>
              ) : (
                <div className="space-y-4">
                  {pages.map((page) => {
                    const draft = drafts[page.id] ?? { bio: page.bio ?? "", slug: page.slug };
                    const isSaving = savingId === page.id;
                    return (
                      <article
                        key={page.id}
                        className="rounded-[26px] border border-line bg-surface p-5 sm:p-6 shadow-[0_18px_60px_rgba(0,0,0,0.25)] space-y-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {page.imageS3Key ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/artist/${page.slug}/image?variant=profile`}
                                alt={page.alias}
                                className="h-11 w-11 rounded-full object-cover border border-line"
                              />
                            ) : (
                              <div className="h-11 w-11 rounded-full border border-line bg-white/5" />
                            )}
                            <div>
                              <h3 className="text-lg font-medium">{page.alias}</h3>
                              <Link
                                href={`/artist/${page.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-ink-dim hover:text-ink-muted transition-colors"
                              >
                                /artist/{page.slug}
                              </Link>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/artist/${page.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-line bg-white/5 px-3 py-1.5 text-xs text-ink/75 transition-colors hover:bg-white/10 hover:text-ink"
                            >
                              {t("artistPages.open")}
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(page.id, page.alias)}
                              className="rounded-full border border-line bg-white/5 px-3 py-1.5 text-xs text-ink-dim transition-colors hover:border-red-400/40 hover:text-red-200"
                            >
                              {t("artistPages.delete")}
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-2">
                          <Field
                            label={t("artistPages.slug")}
                            hint={t("artistPages.slugHint", { slug: draft.slug })}
                          >
                            <input
                              type="text"
                              value={draft.slug}
                              onChange={(e) => setDraft(page.id, { slug: e.target.value })}
                              className="input-field text-sm"
                              maxLength={80}
                            />
                          </Field>

                          <Field
                            label={t("artistPages.profileImage")}
                          >
                            <label className="flex h-10 cursor-pointer items-center justify-center rounded-full border border-line bg-white/5 text-sm text-ink/75 transition-colors hover:bg-white/10">
                              {uploading === `${page.id}:profile` ? t("artistPages.uploading") : t("artistPages.chooseImage")}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = "";
                                  if (file) handleImage(page.id, "profile", file);
                                }}
                              />
                            </label>
                          </Field>
                        </div>

                        <Field
                          label={t("artistPages.heroImage")}
                          hint={t("artistPages.heroImageHint")}
                        >
                          <label className="flex h-10 cursor-pointer items-center justify-center rounded-full border border-line bg-white/5 text-sm text-ink/75 transition-colors hover:bg-white/10">
                            {uploading === `${page.id}:hero` ? t("artistPages.uploading") : t("artistPages.chooseImage")}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) handleImage(page.id, "hero", file);
                              }}
                            />
                          </label>
                        </Field>

                        <Field
                          label={t("artistPages.bio")}
                          hint={draft.bio.trim() ? undefined : t("artistPages.bioFallbackHint")}
                        >
                          <textarea
                            value={draft.bio}
                            onChange={(e) => setDraft(page.id, { bio: e.target.value })}
                            placeholder={t("artistPages.bioPlaceholder", { name: page.alias })}
                            maxLength={ARTIST_PAGE_BIO_MAX_LENGTH}
                            rows={5}
                            className="input-field text-sm w-full resize-y"
                          />
                        </Field>

                        <div className="flex items-center justify-end gap-3">
                          {flashId === page.id && <span className="text-xs text-emerald-300">{t("artistPages.saved")}</span>}
                          <button
                            type="button"
                            onClick={() => handleSave(page.id)}
                            disabled={isSaving}
                            className="h-10 rounded-full bg-white px-5 text-sm font-medium text-black transition-colors hover:bg-accent-strong disabled:opacity-50"
                          >
                            {isSaving ? t("artistPages.saving") : t("artistPages.save")}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-xs font-medium uppercase tracking-wider text-ink-dim">{t("artistPages.createHeading")}</h2>

              {!loading && availableAliases.length === 0 ? (
                <div className=" border border-dashed border-line bg-white/3 p-8 text-sm text-ink/55">
                  {pages.length === 0 ? t("artistPages.noAliasesAtAll") : t("artistPages.noAliasesLeft")}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableAliases.map((alias) => (
                    <button
                      key={alias}
                      type="button"
                      onClick={() => handleCreate(alias)}
                      disabled={creating !== null}
                      className="rounded-full border border-line bg-white/5 px-4 py-2 text-sm text-ink/75 transition-colors hover:bg-white/10 hover:text-ink disabled:opacity-50"
                    >
                      {creating === alias ? t("artistPages.creating") : `${t("artistPages.create")} · ${alias}`}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
