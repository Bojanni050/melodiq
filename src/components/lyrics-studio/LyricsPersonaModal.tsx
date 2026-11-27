"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/hooks/useT";
import {
  MAX_PERSONA_BIO,
  MAX_PERSONA_FRAGMENTS,
  MAX_PERSONA_NAME,
  type LyricPersona,
  type LyricPersonaFragment,
} from "@/lib/lyric-personas";

interface LyricsPersonaModalProps {
  open: boolean;
  activePersona: LyricPersona | null;
  /** Local lyrics snapshots that are not in the database yet. */
  extraLyrics: Array<{ title: string; lyrics: string }>;
  onClose: () => void;
  onApply: (persona: LyricPersona) => void;
  onClear: () => void;
}

type Notice = { type: "error" | "success"; message: string } | null;

export default function LyricsPersonaModal({
  open,
  activePersona,
  extraLyrics,
  onClose,
  onApply,
  onClear,
}: LyricsPersonaModalProps) {
  const t = useT();
  const [personas, setPersonas] = useState<LyricPersona[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [selected, setSelected] = useState<LyricPersonaFragment[]>([]);
  const [available, setAvailable] = useState<LyricPersonaFragment[]>([]);
  const [loadingFragments, setLoadingFragments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [sourceCount, setSourceCount] = useState(0);
  const wasOpen = useRef(false);

  const resetForm = useCallback((persona: LyricPersona | null) => {
    setEditingId(persona?.id ?? null);
    setName(persona?.name ?? "");
    setBio(persona?.bio ?? "");
    setSelected(persona?.fragments ?? []);
    setAvailable([]);
    setConfirmDelete(false);
    setNotice(null);
  }, []);

  const fetchFragments = useCallback(async (exclude: LyricPersonaFragment[]) => {
    setLoadingFragments(true);
    setNotice(null);
    try {
      const response = await fetch("/api/lyric-personas/fragments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          excludeIds: exclude.map((fragment) => fragment.id),
          extraLyrics,
          limit: 24,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice({ type: "error", message: data?.error || t("lyricsStudio.personaFragmentsLoadFailed") });
        return;
      }
      setAvailable(Array.isArray(data.fragments) ? data.fragments : []);
      setSourceCount(typeof data.sourceCount === "number" ? data.sourceCount : 0);
    } catch {
      setNotice({ type: "error", message: t("lyricsStudio.personaFragmentsLoadFailed") });
    } finally {
      setLoadingFragments(false);
    }
  }, [extraLyrics, t]);

  // Only initialise when the modal opens, not on every prop change.
  useEffect(() => {
    if (open && !wasOpen.current) {
      wasOpen.current = true;
      resetForm(activePersona);
      setNotice(null);
      setLoadingPersonas(true);
      fetch("/api/lyric-personas")
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            setNotice({ type: "error", message: data?.error || t("lyricsStudio.personaLoadFailed") });
            return;
          }
          setPersonas(Array.isArray(data.personas) ? data.personas : []);
        })
        .catch(() => setNotice({ type: "error", message: t("lyricsStudio.personaLoadFailed") }))
        .finally(() => setLoadingPersonas(false));
      void fetchFragments(activePersona?.fragments ?? []);
    }
    if (!open) wasOpen.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function addFragment(fragment: LyricPersonaFragment) {
    if (selected.length >= MAX_PERSONA_FRAGMENTS) return;
    setSelected((current) => [...current, fragment]);
    setAvailable((current) => current.filter((item) => item.id !== fragment.id));
  }

  function removeFragment(fragment: LyricPersonaFragment) {
    setSelected((current) => current.filter((item) => item.id !== fragment.id));
    setAvailable((current) => [fragment, ...current]);
  }

  function startNewPersona() {
    resetForm(null);
    void fetchFragments([]);
  }

  function editPersona(persona: LyricPersona) {
    resetForm(persona);
    void fetchFragments(persona.fragments);
  }

  async function savePersona() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNotice({ type: "error", message: t("lyricsStudio.personaNameRequired") });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(editingId ? `/api/lyric-personas/${editingId}` : "/api/lyric-personas", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, bio, fragments: selected }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.persona) {
        setNotice({ type: "error", message: data?.error || t("lyricsStudio.personaSaveFailed") });
        return;
      }

      const persona = data.persona as LyricPersona;
      setPersonas((current) => {
        const without = current.filter((item) => item.id !== persona.id);
        return [persona, ...without];
      });
      onApply(persona);
      onClose();
    } catch {
      setNotice({ type: "error", message: t("lyricsStudio.personaSaveFailed") });
    } finally {
      setSaving(false);
    }
  }

  async function deletePersona() {
    if (!editingId || deleting) return;
    setDeleting(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/lyric-personas/${editingId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setNotice({ type: "error", message: data?.error || t("lyricsStudio.personaDeleteFailed") });
        return;
      }
      const wasActive = activePersona?.id === editingId;
      setPersonas((current) => current.filter((item) => item.id !== editingId));
      if (wasActive) onClear();
      resetForm(null);
      void fetchFragments([]);
    } catch {
      setNotice({ type: "error", message: t("lyricsStudio.personaDeleteFailed") });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col border border-line bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">{editingId ? t("lyricsStudio.personaEditTitle") : t("lyricsStudio.personaNewTitle")}</h2>
            <p className="mt-1 text-sm text-ink-dim">{t("lyricsStudio.personaHint")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-line bg-white/5 px-3 py-1.5 text-sm text-ink-muted transition hover:bg-white/10 hover:text-ink"
          >
            {t("melody.close")}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">{t("lyricsStudio.personaListHeading")}</span>
            {loadingPersonas ? (
              <span className="text-sm text-ink-dim">{t("lyricsStudio.personaLoading")}</span>
            ) : personas.length === 0 ? (
              <span className="text-sm text-ink-dim">{t("lyricsStudio.personaNoPersonas")}</span>
            ) : (
              personas.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => editPersona(persona)}
                  className={`border px-3 py-1.5 text-sm transition ${
                    editingId === persona.id
                      ? "border-accent bg-accent/15 text-ink"
                      : "border-line bg-white/5 text-ink-muted hover:bg-white/10 hover:text-ink"
                  }`}
                >
                  {persona.name}
                  {activePersona?.id === persona.id ? (
                    <span className="ml-2 text-[10px] font-semibold uppercase text-accent">{t("lyricsStudio.personaActiveBadge")}</span>
                  ) : null}
                </button>
              ))
            )}
            <button
              type="button"
              onClick={startNewPersona}
              className="ml-auto border border-accent bg-accent/15 px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-accent/25"
            >
              + {t("lyricsStudio.personaAdd")}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-dim" htmlFor="persona-name">
                  {t("lyricsStudio.personaNameLabel")}
                </label>
                <input
                  id="persona-name"
                  type="text"
                  value={name}
                  maxLength={MAX_PERSONA_NAME}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("lyricsStudio.personaNamePlaceholder")}
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-dim" htmlFor="persona-bio">
                  {t("lyricsStudio.personaBioLabel")}
                </label>
                <textarea
                  id="persona-bio"
                  value={bio}
                  maxLength={MAX_PERSONA_BIO}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder={t("lyricsStudio.personaBioPlaceholder")}
                  rows={5}
                  className="input-field resize-y text-sm"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
                    {t("lyricsStudio.personaSelectedHeading", { count: selected.length })}
                  </span>
                  <span className="text-[11px] text-ink-dim">{t("lyricsStudio.personaMaxHint", { count: MAX_PERSONA_FRAGMENTS })}</span>
                </div>
                {selected.length === 0 ? (
                  <p className="border border-dashed border-line px-3 py-4 text-sm text-ink-dim">
                    {t("lyricsStudio.personaPickHint")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selected.map((fragment) => (
                      <div key={fragment.id} className="border border-accent/40 bg-accent/5 px-3 py-2">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                            {fragment.kind === "chorus" ? t("lyricsStudio.personaChorusLabel") : t("lyricsStudio.personaCoupletLabel")}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFragment(fragment)}
                            className="text-[11px] text-ink-dim underline decoration-dotted hover:text-ink"
                          >
                            {t("lyricsStudio.personaCancelButton")}
                          </button>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-5 text-ink">{fragment.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
                  {t("lyricsStudio.personaAvailableHeading")}
                </span>
                <button
                  type="button"
                  onClick={() => void fetchFragments(selected)}
                  disabled={loadingFragments}
                  className="border border-line bg-white/5 px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-white/10 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loadingFragments ? t("lyricsStudio.personaLoading") : t("lyricsStudio.personaSuggestButton")}
                </button>
              </div>

              <p className="mb-2 text-[11px] text-ink-dim">
                {t("lyricsStudio.personaPickHint")}
                {sourceCount > 0 ? ` (${t("lyricsStudio.personaSourcesCount", { count: sourceCount })})` : ""}
              </p>

              {loadingFragments ? (
                <p className="py-8 text-center text-sm text-ink-dim">{t("lyricsStudio.personaLoading")}</p>
              ) : available.length === 0 ? (
                <div className="border border-dashed border-line px-3 py-6 text-sm text-ink-dim">
                  <p>{sourceCount === 0 ? t("lyricsStudio.personaNoFragments") : t("lyricsStudio.personaNoMoreFragments")}</p>
                  {sourceCount === 0 ? <p className="mt-1 text-xs">{t("lyricsStudio.personaNoFragmentsHint")}</p> : null}
                </div>
              ) : (
                <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                  {available.map((fragment) => (
                    <button
                      key={fragment.id}
                      type="button"
                      onClick={() => addFragment(fragment)}
                      disabled={selected.length >= MAX_PERSONA_FRAGMENTS}
                      className="block w-full border border-line bg-white/5 px-3 py-2 text-left transition hover:border-accent/60 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className={`text-[10px] font-semibold uppercase tracking-wide ${fragment.kind === "chorus" ? "text-accent" : "text-ink-muted"}`}>
                          {fragment.kind === "chorus" ? t("lyricsStudio.personaChorusLabel") : t("lyricsStudio.personaCoupletLabel")}
                        </span>
                        {fragment.sourceTitle ? (
                          <span className="truncate text-[11px] text-ink-dim">
                            {t("lyricsStudio.personaSourceLabel")}: {fragment.sourceTitle}
                          </span>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-5 text-ink">{fragment.text}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
          {notice ? (
            <p className={`text-sm ${notice.type === "error" ? "text-red-300" : "text-emerald-300"}`}>{notice.message}</p>
          ) : (
            <p className="text-xs text-ink-dim">{t("lyricsStudio.personaFragmentsCount", { count: selected.length })}</p>
          )}

          <div className="ml-auto flex items-center gap-2">
            {editingId ? (
              confirmDelete ? (
                <>
                  <span className="text-sm text-ink-muted">{t("lyricsStudio.personaDeleteConfirm")}</span>
                  <button
                    type="button"
                    onClick={() => void deletePersona()}
                    disabled={deleting}
                    className="border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/25 disabled:opacity-40"
                  >
                    {deleting ? t("lyricsStudio.personaSaving") : t("lyricsStudio.personaDeleteButton")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="border border-line bg-white/5 px-3 py-2 text-sm text-ink-muted hover:bg-white/10 hover:text-ink"
                  >
                    {t("lyricsStudio.personaCancelButton")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
                >
                  {t("lyricsStudio.personaDeleteButton")}
                </button>
              )
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="border border-line bg-white/5 px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-white/10 hover:text-ink"
            >
              {t("lyricsStudio.personaCancelButton")}
            </button>
            <button
              type="button"
              onClick={() => void savePersona()}
              disabled={saving || !name.trim()}
              className="border border-accent bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? t("lyricsStudio.personaSaving") : t("lyricsStudio.personaSaveButton")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
