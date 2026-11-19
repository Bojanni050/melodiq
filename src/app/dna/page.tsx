"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import CalibrateModal from "@/components/dna/CalibrateModal";
import DnaHelix from "@/components/dna/DnaHelix";
import ShareDnaCard from "@/components/dna/ShareDnaCard";
import { useLocaleStore, useSidebarStore } from "@/lib/store";
import { useT } from "@/hooks/useT";
import type { TranslationKey } from "@/lib/i18n/translate";

type DnaTraitPayload = {
  key: string;
  category: string;
  label: string;
  kind: "number" | "text" | "list" | "ratio";
  value: number | null;
  text: string | null;
  unit: string | null;
  display: string | null;
  confidence: number;
  sourceCount: number;
  weight: number;
  verdict: "confirmed" | "disputed" | null;
  direction: "more" | "less" | null;
  feedbackAt: string | null;
  /** Derived server-side: dark | learning | sure | pulsing | locked. */
  state?: "dark" | "learning" | "sure" | "pulsing" | "locked";
  trend?: "up" | "down" | "steady";
  pulsing?: boolean;
  lockedAt?: string | null;
};

type DnaFeedbackKind = "confirm" | "reject" | "more" | "less" | "reset";

type DnaProfilePayload = {
  name: string | null;
  summary: string | null;
  sourceCount: number;
  ratedCount: number;
  likedCount: number;
  dislikedCount: number;
  computedAt: string | null;
};

type DnaResponse = {
  profile: DnaProfilePayload | null;
  traits: DnaTraitPayload[];
  categories: Array<{ id: string; label: string }>;
  /** "1200 songs · 0 edits · 2 calibrations" plus the raw counters. */
  signals?: { songs: number; edits: number; calibrations: number; label: string };
  changes?: Array<{ traitKey: string; direction: string; changedAt: string }>;
};

// A trait only reads as settled once the aggregator's confidence clears this.
// Below it the card stays visibly "still learning" instead of pretending the
// value is a fact.
const SOLID_CONFIDENCE = 0.45;

// Profile stages, mirroring how much evidence exists: a seed has barely any
// tracks, a full profile needs enough songs that the averages mean something.
const SPROUT_AT = 5;
const GROWN_AT = 15;

const TRAIT_LABEL_KEYS: Record<string, TranslationKey> = {
  tempo: "dna.traits.tempo",
  tempo_intent: "dna.traits.tempo_intent",
  half_time_share: "dna.traits.half_time_share",
  energy: "dna.traits.energy",
  atmospheres: "dna.traits.atmospheres",
  genres: "dna.traits.genres",
  instrumental_share: "dna.traits.instrumental_share",
  production_score: "dna.traits.production_score",
  vocal_gender: "dna.traits.vocal_gender",
  vocal_score: "dna.traits.vocal_score",
  length: "dna.traits.length",
  composition_score: "dna.traits.composition_score",
  language: "dna.traits.language",
  lyric_words: "dna.traits.lyric_words",
  lyric_score: "dna.traits.lyric_score",
  loved_genres: "dna.traits.loved_genres",
  avoided_genres: "dna.traits.avoided_genres",
  love_rate: "dna.traits.love_rate",
  overall_score: "dna.traits.overall_score",
  rhyme_scheme: "dna.traits.rhyme_scheme",
  rhyme_density: "dna.traits.rhyme_density",
  internal_rhyme: "dna.traits.internal_rhyme",
  multisyllabic_rhyme: "dna.traits.multisyllabic_rhyme",
  line_syllables: "dna.traits.line_syllables",
  line_length_spread: "dna.traits.line_length_spread",
  pov: "dna.traits.pov",
  tense: "dna.traits.tense",
  explicitness: "dna.traits.explicitness",
  signature_words: "dna.traits.signature_words",
  themes: "dna.traits.themes",
  writing_languages: "dna.traits.writing_languages",
  song_structure: "dna.traits.song_structure",
  chorus_lines: "dna.traits.chorus_lines",
  repetition: "dna.traits.repetition",
  ad_libs: "dna.traits.ad_libs",
  bridge: "dna.traits.bridge",
};

const CATEGORY_LABEL_KEYS: Record<string, TranslationKey> = {
  sound: "dna.categories.sound",
  voice: "dna.categories.voice",
  structure: "dna.categories.structure",
  words: "dna.categories.words",
  taste: "dna.categories.taste",
};

// Each category keeps one hue across its dot, meter and value, so the five
// groups stay readable at a glance without colouring the whole card.
const CATEGORY_STYLES: Record<string, { dot: string; bar: string; text: string }> = {
  sound: { dot: "bg-sky-400", bar: "bg-sky-400/70", text: "text-sky-200" },
  voice: { dot: "bg-violet-400", bar: "bg-violet-400/70", text: "text-violet-200" },
  structure: { dot: "bg-amber-300", bar: "bg-amber-300/70", text: "text-amber-200" },
  words: { dot: "bg-emerald-300", bar: "bg-emerald-300/70", text: "text-emerald-200" },
  taste: { dot: "bg-pink-400", bar: "bg-pink-400/70", text: "text-pink-200" },
};

const FALLBACK_STYLE = { dot: "bg-accent", bar: "bg-accent/70", text: "text-accent" };

/** list traits store their items as a JSON string in valueText. */
function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Per-language writing traits carry their language in the key, e.g.
 * `rhyme_density:nl`. The bare key is the whole-catalogue value.
 */
function splitTraitKey(key: string): { base: string; language: string | null } {
  const separator = key.indexOf(":");
  if (separator === -1) return { base: key, language: null };
  return { base: key.slice(0, separator), language: key.slice(separator + 1) };
}

/** Language code → the reader's own name for it ("nl" → "Nederlands"). */
function languageLabel(code: string, locale: string): string {
  try {
    const names = new Intl.DisplayNames([locale === "nl" ? "nl" : "en"], { type: "language" });
    return names.of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function formatWhen(iso: string, locale: string): string {  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Corrections the user can give per trait. "More/less" is a preference for the
// generator, not evidence about the catalogue, so it never moves confidence.
const FEEDBACK_ACTIONS: { kind: DnaFeedbackKind; glyph: string; labelKey: TranslationKey }[] = [
  { kind: "confirm", glyph: "✓", labelKey: "dna.confirm" },
  { kind: "reject", glyph: "✕", labelKey: "dna.dispute" },
  { kind: "more", glyph: "↑", labelKey: "dna.more" },
  { kind: "less", glyph: "↓", labelKey: "dna.less" },
];

const FEEDBACK_ACTIVE_STYLES: Record<string, string> = {
  confirm: "border-emerald-400/50 bg-emerald-400/10 text-emerald-300",
  reject: "border-amber-400/50 bg-amber-400/10 text-amber-300",
  more: "border-accent/60 bg-accent/10 text-accent",
  less: "border-accent/60 bg-accent/10 text-accent",
};

function isFeedbackActive(trait: DnaTraitPayload, kind: DnaFeedbackKind): boolean {
  if (kind === "confirm") return trait.verdict === "confirmed";
  if (kind === "reject") return trait.verdict === "disputed";
  return trait.direction === kind;
}

function TraitFeedback({
  trait,
  pending,
  onSend,
}: {
  trait: DnaTraitPayload;
  pending: boolean;
  onSend: (traitKey: string, kind: DnaFeedbackKind) => void;
}) {
  const t = useT();
  const hasStance = trait.verdict !== null || trait.direction !== null;

  return (
    <div className="flex items-center gap-1">
      {FEEDBACK_ACTIONS.map(({ kind, glyph, labelKey }) => {
        const active = isFeedbackActive(trait, kind);
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={active}
            // Already-active options stay disabled: changing a verdict means
            // picking another one, and clearing has its own button.
            disabled={pending || active}
            title={t(labelKey)}
            aria-label={t(labelKey)}
            onClick={() => onSend(trait.key, kind)}
            className={`flex h-6 w-6 items-center justify-center border text-[11px] leading-none transition-colors disabled:cursor-default ${
              active
                ? FEEDBACK_ACTIVE_STYLES[kind]
                : "border-line text-ink-dim enabled:hover:border-line-strong enabled:hover:text-ink-muted"
            }`}
          >
            {glyph}
          </button>
        );
      })}
      {hasStance && (
        <button
          type="button"
          disabled={pending}
          title={t("dna.clearFeedback")}
          aria-label={t("dna.clearFeedback")}
          onClick={() => onSend(trait.key, "reset")}
          className="ml-1 flex h-6 w-6 items-center justify-center border border-line text-[11px] leading-none text-ink-dim transition-colors disabled:cursor-default enabled:hover:border-line-strong enabled:hover:text-ink-muted"
        >
          ↺
        </button>
      )}
    </div>
  );
}

export default function DnaPage() {
  const t = useT();
  const locale = useLocaleStore((s) => s.locale);
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);

  const [data, setData] = useState<DnaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingTrait, setPendingTrait] = useState<string | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  /** "" = the whole-catalogue `words` traits; otherwise a language suffix. */
  const [wordsLanguage, setWordsLanguage] = useState("");

  // First visit has no profile to read yet, so it is built once automatically.
  // Guarded with a ref because React may replay the effect (StrictMode) and a
  // second POST would only repeat the same work.
  const autoBuiltRef = useRef(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const res = await fetch("/api/dna");
        if (!res.ok) throw new Error("load failed");
        const json = (await res.json()) as DnaResponse;
        if (!active) return;
        setData(json);

        if (!json.profile && !autoBuiltRef.current) {
          autoBuiltRef.current = true;
          const built = await fetch("/api/dna/recompute", { method: "POST" });
          if (built.ok) {
            const next = (await built.json()) as DnaResponse;
            if (active) setData(next);
          }
        }
      } catch {
        if (active) setError(t("dna.loadFailed"));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [t]);

  async function handleRebuild() {
    setRebuilding(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/dna/recompute", { method: "POST" });
      if (!res.ok) throw new Error(res.status === 429 ? "rate limited" : "rebuild failed");
      setData((await res.json()) as DnaResponse);
      setNotice(t("dna.rebuilt"));
    } catch (error) {
      setError(error instanceof Error && error.message === "rate limited" ? t("dna.rateLimited") : t("dna.rebuildFailed"));
    } finally {
      setRebuilding(false);
    }
  }

  /** Answers change the stances, so a closed calibration reloads the profile once. */
  async function handleCalibrateClose(changed: boolean) {
    setCalibrating(false);
    if (!changed) return;
    try {
      const res = await fetch("/api/dna");
      if (res.ok) setData((await res.json()) as DnaResponse);
    } catch {
      // The stale profile is still valid; the next visit reloads it.
    }
  }

  /** One correction at a time per trait; the response already holds the result. */
  async function handleFeedback(traitKey: string, kind: DnaFeedbackKind) {
    if (pendingTrait) return;
    setPendingTrait(traitKey);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/dna/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traitKey, kind }),
      });
      if (!res.ok) throw new Error(res.status === 429 ? "rate limited" : "feedback failed");
      setData((await res.json()) as DnaResponse);
    } catch (error) {
      setError(error instanceof Error && error.message === "rate limited" ? t("dna.rateLimited") : t("dna.feedbackFailed"));
    } finally {
      setPendingTrait(null);
    }
  }

  async function handleLock(traitKey: string, locked: boolean) {
    if (pendingTrait) return;
    setPendingTrait(traitKey);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/dna/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traitKey, locked }),
      });
      if (!res.ok) throw new Error(res.status === 429 ? "rate limited" : "lock failed");
      setData((await res.json()) as DnaResponse);
    } catch (error) {
      setError(error instanceof Error && error.message === "rate limited" ? t("dna.rateLimited") : t("dna.lockFailed"));
    } finally {
      setPendingTrait(null);
    }
  }

  const profile = data?.profile ?? null;
  const traits = data?.traits ?? [];

  const traitsByCategory = useMemo(() => {
    const map: Record<string, DnaTraitPayload[]> = {};
    for (const trait of traits) {
      (map[trait.category] ??= []).push(trait);
    }
    return map;
  }, [traits]);

  // Languages that own a per-language `words` set, most tracks first. The
  // overall set (bare keys) is the default view — showing every language at
  // once buries the whole-catalogue picture under a wall of suffixed cards.
  const wordsLanguages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const trait of traitsByCategory.words ?? []) {
      const { language } = splitTraitKey(trait.key);
      if (!language) continue;
      counts.set(language, Math.max(counts.get(language) ?? 0, trait.sourceCount));
    }
    return [...counts.entries()]
      .map(([code, sourceCount]) => ({ code, sourceCount, label: languageLabel(code, locale) }))
      .sort((a, b) => b.sourceCount - a.sourceCount || a.label.localeCompare(b.label));
  }, [traitsByCategory, locale]);

  // A rebuild can drop a language below its threshold; fall back to the
  // overall set instead of leaving an empty section with a stale selection.
  const activeWordsLanguage = wordsLanguages.some((entry) => entry.code === wordsLanguage)
    ? wordsLanguage
    : "";

  const solidCount = traits.filter((trait) => trait.confidence >= SOLID_CONFIDENCE).length;
  const coverage = traits.length > 0 ? Math.round((solidCount / traits.length) * 100) : 0;

  // Preview of the hint /api/generate appends at "Strong". Refetched whenever a
  // confidence or correction changes, so it never drifts from the payload.
  const [dnaHint, setDnaHint] = useState("");
  const hintSignature = traits
    .map((trait) => `${trait.key}:${trait.confidence}:${trait.direction ?? ""}`)
    .join("|");

  useEffect(() => {
    if (traits.length === 0) {
      setDnaHint("");
      return;
    }
    let cancelled = false;
    fetch("/api/dna/context?strength=strong")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { text?: string } | null) => {
        if (!cancelled) setDnaHint(payload?.text ?? "");
      })
      .catch(() => {
        // A missing preview is not worth an error banner.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintSignature]);

  const sourceCount = profile?.sourceCount ?? 0;
  const stage = sourceCount >= GROWN_AT ? "grown" : sourceCount >= SPROUT_AT ? "sprout" : "seed";
  const stageLabel = t(
    stage === "grown" ? "dna.stageGrown" : stage === "sprout" ? "dna.stageSprout" : "dna.stageSeed"
  );
  const nextStageAt = stage === "seed" ? SPROUT_AT : stage === "sprout" ? GROWN_AT : null;

  // The helix and the share card read the same localised traits as the cards
  // below, so a node label never contradicts the section it points at.
  const categoryLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const category of data?.categories ?? []) {
      const labelKey = CATEGORY_LABEL_KEYS[category.id];
      map[category.id] = labelKey ? t(labelKey) : category.label;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.categories, locale]);

  const helixTraits = useMemo(
    () =>
      traits.map((trait) => {
        const { base, language } = splitTraitKey(trait.key);
        const labelKey = TRAIT_LABEL_KEYS[base];
        const label = labelKey ? t(labelKey) : trait.label;
        return {
          key: trait.key,
          category: trait.category,
          // The helix mixes every set, so the language stays visible here even
          // though the filtered cards below already say it.
          label: language ? `${label} (${language.toUpperCase()})` : label,
          display: trait.display ?? "",
          confidence: trait.confidence,
          verdict: trait.verdict,
          direction: trait.direction,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [traits, locale]
  );

  const [selectedTrait, setSelectedTrait] = useState<string | null>(null);

  const isEmpty = !loading && (!profile || profile.sourceCount === 0);

  return (
    <div className="relative h-screen bg-canvas overflow-hidden text-ink">
      <Sidebar credits={null} />

      <div
        className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] overflow-y-auto"
        style={{
          marginLeft: !isDesktop
            ? 0
            : sidebarCollapsed
              ? "var(--sidebar-collapsed)"
              : isQHD
                ? "var(--sidebar-width-qhd)"
                : "var(--sidebar-width)",
        }}
      >
        <main className="relative z-10 min-w-0 px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 lg:pt-5">
          <div className="max-w-400 mx-auto space-y-6">
            {loading ? (
              <div className="border border-line bg-white/5 p-8 text-sm text-ink-muted">
                {t("dna.rebuilding")}
              </div>
            ) : isEmpty ? (
              <section className="border border-line bg-surface/40 px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white/5">
                  <svg className="h-6 w-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 3c0 4 10 5 10 9S7 17 7 21M17 3c0 4-10 5-10 9s10 5 10 9M8.5 7h7M8.5 17h7M9 12h6"
                    />
                  </svg>
                </div>
                <h1 className="mt-4 text-lg font-medium">{t("dna.emptyTitle")}</h1>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{t("dna.emptyBody")}</p>
                <Link
                  href="/studio"
                  className="mt-5 inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-accent-strong"
                >
                  {t("dna.emptyCta")}
                </Link>
                {error && <p className="mt-4 text-xs text-amber-400/80">{error}</p>}
              </section>
            ) : (
              <>
                <section className="relative overflow-hidden border border-line bg-surface/40 p-5 sm:p-6">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-accent/10 blur-3xl"
                  />

                  <div className="relative flex flex-wrap items-start justify-between gap-6">
                    <div className="min-w-0 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-ink-dim">
                        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                        {t("dna.title")}
                        <span className="rounded-full border border-line px-2 py-0.5 text-[10px] normal-case tracking-normal text-ink-muted">
                          {stageLabel}
                        </span>
                      </div>

                      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                        {profile?.name || t("dna.title")}
                      </h1>
                      {profile?.summary && (
                        <p className="mt-2 max-w-xl text-sm text-ink-muted">{profile.summary}</p>
                      )}
                      <p className="mt-3 text-xs text-ink-dim">
                        {t("dna.subtitle", { tracks: sourceCount, ratings: profile?.ratedCount ?? 0 })}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <ShareDnaCard
                          name={profile?.name || t("dna.title")}
                          summary={profile?.summary ?? ""}
                          stageLabel={stageLabel}
                          statsLine={t("dna.cardStats", {
                            tracks: sourceCount,
                            rated: profile?.ratedCount ?? 0,
                            loved: profile?.likedCount ?? 0,
                          })}
                          traits={helixTraits}
                        />
                        <button
                          type="button"
                          onClick={() => setCalibrating(true)}
                          className="inline-flex h-9 items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-4 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <circle cx="12" cy="12" r="9" strokeWidth={2} />
                            <circle cx="12" cy="12" r="4" strokeWidth={2} />
                          </svg>
                          {t("dna.calibrateOpen")}
                        </button>
                        <button
                          type="button"
                          onClick={handleRebuild}
                          disabled={rebuilding}
                          className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-white/5 px-4 text-sm font-medium text-ink transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <svg
                            className={`h-3.5 w-3.5 ${rebuilding ? "animate-spin" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h5M20 20v-5h-5M20 9A8 8 0 006.3 5.7L4 9m16 6l-2.3 3.3A8 8 0 014 15"
                            />
                          </svg>
                          {rebuilding ? t("dna.rebuilding") : t("dna.rebuild")}
                        </button>
                      </div>
                      <p className="text-right text-xs text-ink-dim">
                        {profile?.computedAt
                          ? t("dna.updated", { when: formatWhen(profile.computedAt, locale) })
                          : t("dna.never")}
                      </p>
                      {nextStageAt !== null && (
                        <p className="text-right text-xs text-ink-dim">
                          {t("dna.stageNext", { count: nextStageAt })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="relative mt-6 grid grid-cols-2 gap-px border border-line bg-line/40 sm:grid-cols-4">
                    {[
                      { label: t("dna.statTracks"), value: sourceCount },
                      { label: t("dna.statRated"), value: profile?.ratedCount ?? 0 },
                      { label: t("dna.statLoved"), value: profile?.likedCount ?? 0 },
                      // Melody Genie's header line, split into the two counters that
                      // are not already in the list above: how often the user
                      // corrected a trait, and how many duels they answered.
                      { label: t("dna.statEdits"), value: data?.signals?.edits ?? 0 },
                      { label: t("dna.statCalibrations"), value: data?.signals?.calibrations ?? 0 },
                      { label: t("dna.statSkipped"), value: profile?.dislikedCount ?? 0 },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-canvas/70 px-4 py-3">
                        <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
                        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-ink-dim">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="relative mt-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-xs text-ink-muted">{t("dna.coverage")}</p>
                      <p className="text-xs text-ink-dim">
                        {solidCount}/{traits.length}
                      </p>
                    </div>
                    <div
                      className="mt-1.5 h-1 w-full bg-white/10"
                      title={t("dna.coverageHint")}
                    >
                      <div
                        className="h-full bg-accent/80 transition-[width] duration-500"
                        style={{ width: `${coverage}%` }}
                      />
                    </div>
                  </div>

                  {dnaHint ? (
                    <div className="mt-4 border border-line bg-canvas/60 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-ink-dim">
                        {t("dna.contextTitle")}
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{dnaHint}</p>
                      <p className="mt-2 text-[11px] text-ink-dim">{t("dna.contextHint")}</p>
                    </div>
                  ) : null}
                </section>

                <section className="border border-line bg-surface/20">
                  <header className="flex items-center gap-2 border-b border-line px-4 py-3">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    <h2 className="text-sm font-medium">{t("dna.helixTitle")}</h2>
                    <span className="ml-auto text-xs tabular-nums text-ink-dim">{traits.length}</span>
                  </header>
                  <div className="px-2 py-3 sm:px-4">
                    <DnaHelix
                      traits={helixTraits}
                      categoryLabels={categoryLabels}
                      selectedKey={selectedTrait}
                      onSelect={(key) =>
                        setSelectedTrait((current) => (current === key ? null : key))
                      }
                    />
                  </div>
                </section>

                <CalibrateModal open={calibrating} onClose={handleCalibrateClose} />

                {(error || notice) && (
                  <div className="flex items-start justify-between gap-3 border border-line bg-white/5 px-4 py-3">
                    <p className={`text-sm ${error ? "text-amber-400/90" : "text-ink-muted"}`}>
                      {error ?? notice}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setNotice(null);
                      }}
                      className="shrink-0 text-ink-dim transition-colors hover:text-ink-muted"
                      aria-label="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="space-y-5">
                  {(data?.categories ?? []).map((category) => {
                    const categoryTraits = traitsByCategory[category.id] ?? [];
                    const style = CATEGORY_STYLES[category.id] ?? FALLBACK_STYLE;
                    const isWords = category.id === "words";
                    // Only the words category is split per language; the other
                    // categories are language-agnostic and stay untouched.
                    const visibleTraits = isWords
                      ? categoryTraits.filter(
                          (trait) => splitTraitKey(trait.key).language === (activeWordsLanguage || null)
                        )
                      : categoryTraits;
                    const categorySolid = visibleTraits.filter(
                      (trait) => trait.confidence >= SOLID_CONFIDENCE
                    ).length;
                    const labelKey = CATEGORY_LABEL_KEYS[category.id];

                    return (
                      <section key={category.id} className="border border-line bg-surface/20">
                        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
                          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                          <h2 className="text-sm font-medium">
                            {labelKey ? t(labelKey) : category.label}
                          </h2>
                          <span className="ml-auto flex items-center gap-2">
                            {isWords && wordsLanguages.length > 0 && (
                              <select
                                value={activeWordsLanguage}
                                onChange={(event) => setWordsLanguage(event.target.value)}
                                aria-label={t("dna.wordsLanguage")}
                                title={t("dna.wordsLanguage")}
                                className="border border-line bg-white/5 px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
                              >
                                <option value="">{t("dna.wordsAllLanguages")}</option>
                                {wordsLanguages.map((language) => (
                                  <option key={language.code} value={language.code}>
                                    {language.label} · {language.sourceCount}
                                  </option>
                                ))}
                              </select>
                            )}
                            <span className="text-xs tabular-nums text-ink-dim">
                              {categorySolid}/{visibleTraits.length}
                            </span>
                          </span>
                        </header>

                        {visibleTraits.length === 0 ? (
                          <p className="px-4 py-5 text-sm text-ink-dim">{t("dna.noSignal")}</p>
                        ) : (
                          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                            {visibleTraits.map((trait) => {
                              const solid = trait.confidence >= SOLID_CONFIDENCE;
                              const confidencePct = Math.round(trait.confidence * 100);
                              const labelKey = TRAIT_LABEL_KEYS[splitTraitKey(trait.key).base];
                              const items = trait.kind === "list" ? parseList(trait.text) : [];

                              return (
                                <div
                                  key={trait.key}
                                  id={`trait-${trait.key}`}
                                  className={`border bg-canvas/40 p-3.5 transition-colors ${
                                    selectedTrait === trait.key ? "border-accent/50" : "border-line"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                                      {labelKey ? t(labelKey) : trait.label}
                                      {trait.pulsing ? (
                                        <span
                                          title={t("dna.pulsing")}
                                          className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent"
                                        />
                                      ) : null}
                                    </p>
                                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                                      <span
                                        className={`text-[10px] uppercase tracking-wide ${
                                          trait.lockedAt
                                            ? "text-accent"
                                            : trait.verdict === "confirmed"
                                              ? "text-emerald-300"
                                              : trait.verdict === "disputed"
                                                ? "text-amber-300"
                                                : solid
                                                  ? style.text
                                                  : "text-ink-dim"
                                        }`}
                                      >
                                        {trait.lockedAt
                                          ? t("dna.locked")
                                          : trait.verdict === "confirmed"
                                            ? t("dna.confirmed")
                                            : trait.verdict === "disputed"
                                              ? t("dna.disputed")
                                              : solid
                                                ? t("dna.confidenceShort", { value: confidencePct })
                                                : t("dna.learning")}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleLock(trait.key, !trait.lockedAt)}
                                        disabled={pendingTrait === trait.key}
                                        title={trait.lockedAt ? t("dna.unlock") : t("dna.lock")}
                                        className="text-[10px] uppercase tracking-wide text-ink-dim transition-colors hover:text-ink disabled:opacity-40"
                                      >
                                        {trait.lockedAt ? t("dna.unlock") : t("dna.lock")}
                                      </button>
                                    </span>
                                  </div>

                                  <div className="mt-2 min-h-[1.75rem]">
                                    {trait.kind === "list" ? (
                                      items.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                          {items.map((item) => (
                                            <span
                                              key={item}
                                              className="rounded-full border border-line bg-white/5 px-2 py-0.5 text-xs text-ink"
                                            >
                                              {item}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-ink-dim">—</p>
                                      )
                                    ) : (
                                      <p
                                        className={`text-lg font-medium leading-tight ${
                                          solid ? "text-ink" : "text-ink-muted"
                                        }`}
                                      >
                                        {trait.display ?? "—"}
                                      </p>
                                    )}
                                  </div>

                                  <div className="mt-3 flex items-center gap-2">
                                    <div className="h-1 flex-1 bg-white/10">
                                      <div
                                        className={`h-full ${style.bar}`}
                                        style={{
                                          width: `${Math.round(trait.confidence * 100)}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="shrink-0 text-[10px] tabular-nums text-ink-dim">
                                      {trait.sourceCount === 1
                                        ? t("dna.sourceOne")
                                        : t("dna.sourceMany", { count: trait.sourceCount })}
                                    </span>
                                  </div>

                                  <div className="mt-2.5 border-t border-line/60 pt-2.5">
                                    <TraitFeedback
                                      trait={trait}
                                      pending={pendingTrait === trait.key}
                                      onSend={handleFeedback}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}