"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import LyricsNotice from "@/components/lyrics-studio/LyricsNotice";
import LyricsConfirmModal from "@/components/lyrics-studio/LyricsConfirmModal";
import { combineLyrics } from "@/lib/lyrics-utils";
import { useLyricsDraft } from "@/lib/hooks/useLyricsDraft";
import { useStudioStore, useSidebarStore } from "@/lib/store";
import type { ConfirmAction, LyricsStudioNotice } from "@/lib/lyrics-studio-types";

export default function MelodyPage() {
  const router = useRouter();
  const draft = useLyricsDraft();
  const { topic, mood, style, blocks, styleSuggestion, setStyleSuggestion, creativityLevel, setCreativityLevel } = draft;

  const { title, language, customLanguage } = useStudioStore();
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);

  const [credits] = useState<number | null>(null);
  const [notice, setNotice] = useState<LyricsStudioNotice | null>(null);
  const [generatingStyleSuggestion, setGeneratingStyleSuggestion] = useState(false);
  const [copiedStyleSuggestion, setCopiedStyleSuggestion] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [pendingStudioPayload, setPendingStudioPayload] = useState<{ lyrics: string; style: string } | null>(null);

  const combinedLyrics = useMemo(() => combineLyrics(blocks), [blocks]);
  const isCustomLanguage = language === "Other...";
  const effectiveLanguage = isCustomLanguage ? customLanguage.trim() || "Other" : language;
  const temperature = Number((0.1 + ((creativityLevel - 1) / 9) * 1.1).toFixed(2));
  const creativityZone = creativityLevel <= 3 ? "Braaf" : creativityLevel <= 7 ? "Gebalanceerd" : "Wild";
  const hasLyricsContext = Boolean(topic.trim() && mood.trim() && combinedLyrics.trim());

  async function generateStyleSuggestion() {
    if (!hasLyricsContext) return;
    setGeneratingStyleSuggestion(true);
    try {
      const res = await fetch("/api/lyric-studio/style-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, mood, lyrics: combinedLyrics, language: effectiveLanguage, styleHint: style, temperature }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setNotice({ type: "error", message: d?.error || "Style suggestion genereren is mislukt." });
        return;
      }
      const data = await res.json();
      if (data?.suggestion && typeof data.suggestion === "string") setStyleSuggestion(data.suggestion);
    } catch {
      setNotice({ type: "error", message: "Style suggestion genereren is mislukt." });
    } finally {
      setGeneratingStyleSuggestion(false);
    }
  }

  async function copyStyleSuggestion() {
    if (!styleSuggestion.trim()) return;
    try {
      await navigator.clipboard.writeText(styleSuggestion);
      setCopiedStyleSuggestion(true);
      window.setTimeout(() => setCopiedStyleSuggestion(false), 2000);
    } catch {
      setNotice({ type: "error", message: "Style kopieren mislukt." });
    }
  }

  function useLyricsAndStyleInStudio() {
    const nextLyrics = combinedLyrics.trim();
    const nextStyle = (styleSuggestion.trim() || style.trim()).trim();
    const nextTitle = title.trim();
    if (!nextLyrics || !nextStyle) return;
    const studio = useStudioStore.getState();
    const hasExisting = Boolean(studio.songIdea.trim() || studio.lyrics.trim() || studio.lyricsContext.trim() || studio.title.trim());
    if (hasExisting) {
      setPendingStudioPayload({ lyrics: nextLyrics, style: nextStyle });
      setConfirmAction("replaceStudio");
      return;
    }
    sessionStorage.setItem("lyrics-studio-payload", JSON.stringify({ lyrics: nextLyrics, style: nextStyle, title: nextTitle }));
    router.push("/studio");
  }

  function handleConfirmAction() {
    if (confirmAction === "replaceStudio" && pendingStudioPayload) {
      sessionStorage.setItem("lyrics-studio-payload", JSON.stringify({ lyrics: pendingStudioPayload.lyrics, style: pendingStudioPayload.style, title: title.trim() }));
      router.push("/studio");
    }
    setConfirmAction(null);
    setPendingStudioPayload(null);
  }

  return (
    <div className="flex h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] bg-[#0d0d12] text-white overflow-hidden" style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 0 }}>
      <Sidebar credits={credits} />

      <main className="flex-1 flex flex-col lg:ml-[240px] overflow-hidden pt-[65px] lg:pt-0">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-6 lg:py-8">
            <LyricsNotice notice={notice} onClose={() => setNotice(null)} />

            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2">Melody</h1>
              <p className="text-white/60">AI style direction — genre, instrumentation, production and vocals — based on your lyrics.</p>
            </div>

            {!hasLyricsContext ? (
              <div className="rounded-2xl border border-white/10 bg-[#101018]/80 p-6 text-white/60">
                Schrijf eerst een topic, mood en lyrics in{" "}
                <button type="button" onClick={() => router.push("/lyrics-studio")} className="text-primary-400 underline underline-offset-2 hover:text-primary-300">
                  Lyrics
                </button>
                , voordat je hier een style suggestion kan genereren.
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#181820]/80 p-5">
                <div className="mb-4 flex flex-wrap gap-2 text-xs text-white/50">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Topic: {topic}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Mood: {mood}</span>
                  {style.trim() && <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Style: {style}</span>}
                </div>

                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white/70">Style Suggestion</h3>
                  <button
                    type="button"
                    onClick={generateStyleSuggestion}
                    disabled={generatingStyleSuggestion}
                    className="inline-flex items-center justify-center rounded-lg bg-primary-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Generate style suggestion from topic, mood and lyrics"
                  >
                    {generatingStyleSuggestion ? "Generating..." : "AI Fill"}
                  </button>
                </div>

                <div className="mb-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/45">Creativity</span>
                    <span className={`text-[10px] font-medium ${
                      creativityLevel <= 3 ? "text-blue-400" : creativityLevel <= 7 ? "text-yellow-400" : "text-orange-400"
                    }`}>
                      {creativityLevel} — {creativityZone}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={creativityLevel}
                    onChange={(e) => setCreativityLevel(Number(e.target.value))}
                    className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-white/10 accent-primary-500"
                  />
                </div>

                <textarea
                  value={styleSuggestion}
                  onChange={(event) => setStyleSuggestion(event.target.value)}
                  placeholder="AI style direction verschijnt hier met genre, instrumentation, production/mix en vocal direction"
                  className="min-h-[240px] w-full resize-y rounded-xl border border-white/10 bg-[#0f0f16] px-3 py-2 text-sm leading-5 text-white/90 outline-none transition placeholder:text-white/25 focus:border-primary-500/60"
                />

                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-white/35">Expanded advice based on topic, mood, language and current lyrics.</p>
                  <button
                    type="button"
                    onClick={copyStyleSuggestion}
                    disabled={!styleSuggestion.trim()}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {copiedStyleSuggestion ? "Copied" : "Copy"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={useLyricsAndStyleInStudio}
                  disabled={!combinedLyrics.trim() || !(styleSuggestion.trim() || style.trim())}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-primary-gradient px-3 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                  title="Copy lyrics and style to Studio"
                >
                  Use lyrics + style in Studio
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <LyricsConfirmModal
        confirmAction={confirmAction}
        onConfirm={handleConfirmAction}
        onCancel={() => { setConfirmAction(null); setPendingStudioPayload(null); }}
      />
    </div>
  );
}
