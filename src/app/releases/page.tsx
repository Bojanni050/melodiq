"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useSidebarStore, useReleaseStore, useUserStore } from "@/lib/store";

const RELEASE_TYPES: { value: string; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "ep", label: "EP" },
  { value: "album", label: "Album" },
];

export default function ReleasesPage() {
  const router = useRouter();
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const { releases, loadReleases, deleteRelease, updateReleaseDetails, renameRelease } = useReleaseStore();
  const user = useUserStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("single");
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtistAlias, setEditArtistAlias] = useState("");
  const [editCredits, setEditCredits] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const createRelease = useReleaseStore((state) => state.createRelease);

  useEffect(() => {
    void loadReleases().finally(() => setLoading(false));
  }, [loadReleases]);

  async function handleCreateRelease() {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const id = await createRelease({ title: newTitle, type: newType });
      if (id) {
        setNewTitle("");
        setShowCreate(false);
        router.push(`/releases/${id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  function openRelease(releaseId: string) {
    router.push(`/releases/${releaseId}`);
  }

  function openEditRelease(release: { id: string; title: string; artistName?: string | null; credits?: string | null }) {
    setEditingReleaseId(release.id);
    setEditTitle(release.title);
    setEditArtistAlias(release.artistName ?? "");
    setEditCredits(release.credits ?? "");
  }

  async function handleSaveEditRelease() {
    if (!editingReleaseId || savingEdit) return;
    const releaseId = editingReleaseId;
    const title = editTitle.trim();
    if (!title) return;
    setSavingEdit(true);
    try {
      renameRelease(releaseId, title);
      updateReleaseDetails(releaseId, { artistName: editArtistAlias, credits: editCredits });
      setEditingReleaseId(null);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="h-screen bg-[#09090d] overflow-hidden text-white">
      <Sidebar credits={null} />

      <div className="h-[calc(100vh-var(--player-height))]" style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}>
        <main className="h-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 lg:pt-5">
          <div className="max-w-400 mx-auto space-y-6">
            <section className="px-1 py-2 sm:px-2">
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.28em] text-white/35">Discography</p>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Releases</h1>
                <p className="max-w-2xl text-sm sm:text-base text-white/60">
                  Group tracks into singles, EPs, and albums — including remix singles or multi-track (A/B side) releases.
                </p>
              </div>
            </section>

            <section className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                  {releases.length} releases
                </div>
                {showCreate ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleCreateRelease(); if (e.key === "Escape") { setShowCreate(false); setNewTitle(""); } }}
                      placeholder="Release title"
                      maxLength={255}
                      className="h-9 w-48 rounded-full bg-transparent px-3 text-sm text-white placeholder:text-white/30 outline-none"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      {RELEASE_TYPES.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setNewType(t.value)}
                          className={`h-9 rounded-full px-3 text-sm font-medium transition-colors ${
                            newType === t.value ? "bg-primary-500/80 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={handleCreateRelease} disabled={creating} className="h-9 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-50">
                      {creating ? "Creating…" : "Add"}
                    </button>
                    <button type="button" onClick={() => { setShowCreate(false); setNewTitle(""); }} className="h-9 rounded-full px-4 text-sm text-white/60 transition-colors hover:text-white">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="h-10 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    + Create release
                  </button>
                )}
              </div>

              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">Loading releases...</div>
              ) : releases.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/3 p-8 text-sm text-white/55">
                  No releases yet. Create one above, or add a track to a release from track actions.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {releases.map((release) => (
                    <article
                      key={release.id}
                      className="group overflow-hidden rounded-[26px] border border-white/10 bg-[#0f1017] shadow-[0_18px_60px_rgba(0,0,0,0.25)]"
                    >
                      <button type="button" onClick={() => openRelease(release.id)} className="block w-full text-left">
                        <div className="relative aspect-4/3 overflow-hidden bg-linear-135 from-[#1d2333] to-[#0f121a]">
                          {release.coverUrl ? (
                            <img
                              src={release.coverUrl}
                              alt={release.title}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <svg className="h-14 w-14 text-white/35" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="9" strokeWidth={1.2} />
                                <circle cx="12" cy="12" r="3" strokeWidth={1.2} />
                              </svg>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-linear-to-t from-black/65 via-transparent to-black/10" />
                          <span className="absolute left-4 top-4 rounded-full bg-black/60 px-2.5 py-1 text-[11px] uppercase tracking-wide text-white/80 backdrop-blur-sm">
                            {release.type}
                          </span>
                          <div className="absolute inset-x-0 bottom-0 p-4">
                            <h3 className="truncate text-lg font-semibold text-white">{release.title}</h3>
                            <p className="text-sm text-white/75">{release.tracks.length} tracks{release.kind ? ` · ${release.kind}` : ""}</p>
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center justify-between gap-2 px-4 py-3">
                        <button type="button" onClick={() => openRelease(release.id)} className="text-sm text-white/60 transition-colors hover:text-white">
                          Open release
                        </button>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openEditRelease(release)}
                            className="text-sm text-white/45 transition-colors hover:text-white"
                          >
                            Edit release
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete({ id: release.id, title: release.title })}
                            className="text-sm text-white/45 transition-colors hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {editingReleaseId && (() => {
        const artistAliasOptions = (user?.artistAliases ?? []).filter((alias) => alias.trim());
        const defaultArtistLabel = user?.artistAlias?.trim() || user?.name?.trim() || "Unknown Artist";

        return (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Cancel edit release"
              onClick={() => { if (!savingEdit) setEditingReleaseId(null); }}
              className="absolute inset-0 bg-black/65"
            />
            <div className="relative w-full max-w-[480px] rounded-3xl border border-white/12 bg-[#0f1119] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
              <h3 className="text-lg font-semibold text-white">Edit release</h3>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">Title</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={255}
                    disabled={savingEdit}
                    className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/25 disabled:opacity-60"
                    placeholder="Release title"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">Artist alias</label>
                  {artistAliasOptions.length > 0 ? (
                    <select
                      value={editArtistAlias}
                      onChange={(e) => setEditArtistAlias(e.target.value)}
                      disabled={savingEdit}
                      className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25 disabled:opacity-60"
                    >
                      <option value="">{`Default (${defaultArtistLabel})`}</option>
                      {artistAliasOptions.map((alias) => (
                        <option key={alias} value={alias}>{alias}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/55">
                      {defaultArtistLabel}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">Credits</label>
                  <textarea
                    value={editCredits}
                    onChange={(e) => setEditCredits(e.target.value.slice(0, 2000))}
                    rows={3}
                    disabled={savingEdit}
                    placeholder="e.g. Produced by, Written by, Mixed by…"
                    className="w-full resize-none rounded-xl border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/25 disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingReleaseId(null)}
                  disabled={savingEdit}
                  className="h-10 rounded-full bg-white/8 px-4 text-sm font-medium text-white/70 transition-colors hover:bg-white/14 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditRelease}
                  disabled={savingEdit || !editTitle.trim()}
                  className="h-10 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingEdit ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {pendingDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
          <button type="button" aria-label="Cancel delete" onClick={() => setPendingDelete(null)} className="absolute inset-0 bg-black/65" />
          <div className="relative w-full max-w-[420px] rounded-3xl border border-white/12 bg-[#0f1119] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <h3 className="text-lg font-semibold text-white">Delete release?</h3>
            <p className="mt-2 text-sm text-white/60">
              "{pendingDelete.title}" will be removed. Tracks themselves aren't deleted.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDelete(null)} className="h-10 rounded-full bg-white/8 px-4 text-sm font-medium text-white/70 transition-colors hover:bg-white/14">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { deleteRelease(pendingDelete.id); setPendingDelete(null); }}
                className="h-10 rounded-full bg-red-500/80 px-4 text-sm font-medium text-white transition-colors hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
