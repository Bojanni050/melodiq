"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useStudioStore } from "@/lib/store";

const STRUCTURES = [
  { label: "Eenvoudige pop-variaties", group: true },
  { value: "abab", label: "ABAB", desc: "Vers – Refrein – Vers – Refrein. Simpel, radio-vriendelijk." },
  { value: "ababc", label: "ABABC", desc: "Vers – Refrein – Vers – Refrein – Brug/Outro. Extra ruimte voor finale." },
  { value: "ababcbc", label: "ABABCBC", desc: "Extra herhaling van B/C voor dramatische build-up. Festival-stijl." },
  { value: "aaa", label: "AAA (alleen couplet)", desc: "Alles is tekst-vers, muziek herhaalt zich. Volksliedjes, ballads." },
  { value: "aaba", label: "AABA (klassieke 32-bar)", desc: "A-vers – A-vers – B-brug – A-vers. Jazz, ballads, cine-muziek." },
  { label: "Dance / TCH-stijl", group: true },
  { value: "dance-2drops", label: "Intro → Verse → Build → Drop → Verse → Build → Drop → Outro", desc: "Klassieke 2-drops-structuur. House/techno." },
  { value: "dance-breaks", label: "Intro → Break → Build → Drop → Break → Build → Drop → Outro", desc: "Twee break-build-drop-blokken. Ideaal voor clubs." },
  { value: "dance-earlydrop", label: "Intro → Verse → Drop → Verse → Break → Build → Drop → Outro", desc: "Direct in de drop. Festival/peak-hour." },
  { value: "one-drop", label: "One-drop / minimal", desc: "Intro → Break → Build → Drop → Outro. Focus op textuur." },
  { label: "Singer-songwriter pop", group: true },
  { value: "pop-classic", label: "Intro → Verse → Chorus → Verse → Chorus → Bridge → Chorus → Outro", desc: "Klassieke pop-structuur (ABABCB). Radio-ready." },
  { value: "pop-finallift", label: "Intro → Verse → Chorus → Bridge → Chorus → Final lift", desc: "Extra brug + lift (strip-down + build-up)." },
  { value: "pop-prechorus", label: "Intro → Verse → Chorus → Pre-Chorus → Chorus → Bridge → Outro", desc: "Pre-chorus voegt spanning toe. Dramatische pop." },
  { value: "pop-triplechorus", label: "Intro → Verse → Chorus → Verse → Chorus → Chorus → Outro", desc: "Drie keer refrein voor sticky effect." },
  { value: "pop-instrumental", label: "Intro → Verse → Chorus → Bridge → Instrumental → Chorus → Outro", desc: "Instrumentale highlight na de brug. Solo/pads." },
  { value: "ai-choose", label: "Kies jij maar", desc: "AI kiest de beste structuur." },
  { value: "manual", label: "Handmatig", desc: "Typ je eigen structuur." },
];

export default function LyricsStudioPage() {
  const [credits, setCredits] = useState<number | null>(null);
  const {
    structure,
    customStructure,
    setStructure,
    setCustomStructure,
  } = useStudioStore();
  const [showStructureDropdown, setShowStructureDropdown] = useState(false);

  return (
    <div className="flex h-screen bg-[#0d0d12] text-white overflow-hidden">
      <Sidebar credits={credits} />
      
      <main className="flex-1 flex flex-col lg:ml-[240px] overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2">Lyric Studio</h1>
              <p className="text-white/60">Plan your song structure and arrangement</p>
            </div>

            {/* Structure Section */}
            <section className="section-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white/80">Song Structure</h3>
                {structure && (
                  <button
                    onClick={() => { setStructure(""); setCustomStructure(""); }}
                    className="text-white/30 hover:text-white/60 transition-colors"
                    title="Clear"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowStructureDropdown(!showStructureDropdown)}
                  className="w-full input-field text-left text-sm flex items-center justify-between"
                >
                  <span className={structure ? "text-white" : "text-white/40"}>
                    {structure === "ai-choose" ? "Kies jij maar"
                      : structure === "manual" ? "Handmatig"
                      : structure ? STRUCTURES.find(s => s.value === structure)?.label || "Select..."
                      : "Select song structure..."}
                  </span>
                  <svg className={`w-4 h-4 transition-transform ${showStructureDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showStructureDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                    {STRUCTURES.map((item, idx) => {
                      if (item.group) {
                        return (
                          <div key={idx} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30 bg-white/5">
                            {item.label}
                          </div>
                        );
                      }
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            setStructure(item.value || "");
                            setShowStructureDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 transition-colors ${
                            structure === item.value
                              ? "bg-primary-500/10 text-white"
                              : "text-white/60 hover:bg-white/5"
                          }`}
                        >
                          <p className="text-sm">{item.label}</p>
                          <p className="text-xs text-white/30 mt-0.5">{item.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {structure === "manual" && (
                <textarea
                  value={customStructure}
                  onChange={(e) => setCustomStructure(e.target.value)}
                  placeholder="Describe your custom song structure... e.g. Intro → Verse → Chorus → Solo → Outro"
                  className="input-field min-h-[80px] resize-y text-sm mt-3"
                />
              )}

              {structure === "ai-choose" && (
                <p className="text-xs text-white/30 mt-2">
                  AI kiest de beste structuur op basis van je prompt en lyrics
                </p>
              )}

              {structure && structure !== "ai-choose" && structure !== "manual" && (
                <p className="text-xs text-white/30 mt-2">
                  {STRUCTURES.find(s => s.value === structure)?.desc}
                </p>
              )}
            </section>

            {/* Info card */}
            <div className="mt-6 p-4 rounded-lg bg-primary-500/5 border border-primary-500/20">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-primary-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-white/70">
                  <p className="font-medium mb-1">About Song Structure</p>
                  <p className="text-xs text-white/50">
                    Song structure defines how your track is arranged. Choose from proven templates or let AI decide. The structure you select here will be used when generating tracks in the Studio.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
