"use client";

import { useMemo, useState } from "react";
import {
  ERA_OPTIONS,
  INSTRUMENTATION_OPTIONS,
  MOOD_OPTIONS,
  PRIMARY_GENRES,
  PRODUCTION_OPTIONS,
  TEMPO_OPTIONS,
  VOCAL_DIRECTION_OPTIONS,
} from "@/lib/style-studio-constants";

function SearchableDropdown({
  label,
  value,
  options,
  onChange,
  placeholder = "Selecteer…",
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => (query ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase())) : options),
    [options, query]
  );

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-white/45 mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full input-field text-left text-sm flex items-center justify-between"
      >
        <span className={value ? "text-white" : "text-white/35"}>{value || placeholder}</span>
        <svg className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/10 bg-[#1a1a24] shadow-2xl">
          <input
            type="text"
            placeholder="Zoeken…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border-b border-white/10 rounded-t-lg text-sm placeholder-white/30 focus:outline-none focus:border-primary-500"
          />
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-white/40">Geen resultaten</p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`w-full px-3 py-1.5 text-left text-sm rounded transition-colors ${
                    value === option ? "bg-primary-500/15 text-white" : "text-white/80 hover:bg-white/5"
                  }`}
                >
                  {option}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (option: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/45 mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isSelected
                  ? "bg-primary-500/20 border-primary-400/50 text-white"
                  : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function StyleControlPanel({
  primaryGenre,
  setPrimaryGenre,
  secondaryGenre,
  setSecondaryGenre,
  moods,
  setMoods,
  instrumentation,
  setInstrumentation,
  vocalDirection,
  setVocalDirection,
  tempo,
  setTempo,
  era,
  setEra,
  production,
  setProduction,
}: {
  primaryGenre: string;
  setPrimaryGenre: (v: string) => void;
  secondaryGenre: string;
  setSecondaryGenre: (v: string) => void;
  moods: string[];
  setMoods: (v: string[]) => void;
  instrumentation: string[];
  setInstrumentation: (v: string[]) => void;
  vocalDirection: string[];
  setVocalDirection: (v: string[]) => void;
  tempo: string;
  setTempo: (v: string) => void;
  era: string;
  setEra: (v: string) => void;
  production: string[];
  setProduction: (v: string[]) => void;
}) {
  function toggleIn(list: string[], setter: (v: string[]) => void, value: string) {
    if (list.includes(value)) {
      setter(list.filter((v) => v !== value));
    } else {
      setter([...list, value]);
    }
  }

  return (
    <aside className="space-y-5 lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pr-1">
      {/* Genre */}
      <section className="rounded-2xl border border-white/10 bg-[#101018]/80 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white/85">Genre</h3>
        <SearchableDropdown
          label="Primary Genre"
          value={primaryGenre}
          options={PRIMARY_GENRES}
          onChange={setPrimaryGenre}
          placeholder="Kies een genre…"
        />
        <SearchableDropdown
          label="Secondary Genre (optional)"
          value={secondaryGenre}
          options={PRIMARY_GENRES}
          onChange={setSecondaryGenre}
          placeholder="Optioneel…"
        />
      </section>

      {/* Mood */}
      <section className="rounded-2xl border border-white/10 bg-[#101018]/80 p-4">
        <ChipGroup
          label="Mood"
          options={MOOD_OPTIONS}
          selected={moods}
          onToggle={(v) => toggleIn(moods, setMoods, v)}
        />
      </section>

      {/* Instrumentation */}
      <section className="rounded-2xl border border-white/10 bg-[#101018]/80 p-4">
        <ChipGroup
          label="Instrumentation"
          options={INSTRUMENTATION_OPTIONS}
          selected={instrumentation}
          onToggle={(v) => toggleIn(instrumentation, setInstrumentation, v)}
        />
      </section>

      {/* Vocal Direction */}
      <section className="rounded-2xl border border-white/10 bg-[#101018]/80 p-4">
        <ChipGroup
          label="Vocal Direction"
          options={VOCAL_DIRECTION_OPTIONS}
          selected={vocalDirection}
          onToggle={(v) => toggleIn(vocalDirection, setVocalDirection, v)}
        />
      </section>

      {/* Tempo */}
      <section className="rounded-2xl border border-white/10 bg-[#101018]/80 p-4 space-y-2">
        <label className="block text-xs font-medium text-white/45">Tempo</label>
        <div className="grid grid-cols-3 gap-2">
          {TEMPO_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTempo(tempo === option.value ? "" : option.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                tempo === option.value
                  ? "bg-primary-500/20 border-primary-400/50 text-white"
                  : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {/* Era */}
      <section className="rounded-2xl border border-white/10 bg-[#101018]/80 p-4 space-y-2">
        <label className="block text-xs font-medium text-white/45">Era</label>
        <div className="flex flex-wrap gap-1.5">
          {ERA_OPTIONS.map((option) => {
            const isSelected = era === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setEra(era === option ? "" : option)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  isSelected
                    ? "bg-primary-500/20 border-primary-400/50 text-white"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </section>

      {/* Production */}
      <section className="rounded-2xl border border-white/10 bg-[#101018]/80 p-4">
        <ChipGroup
          label="Production"
          options={PRODUCTION_OPTIONS}
          selected={production}
          onToggle={(v) => toggleIn(production, setProduction, v)}
        />
      </section>
    </aside>
  );
}
