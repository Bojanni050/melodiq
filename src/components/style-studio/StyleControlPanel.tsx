"use client";

import { useMemo, useState } from "react";
import {
  ERA_OPTIONS,
  GROOVE_OPTIONS,
  HARMONY_CHARACTER_OPTIONS,
  INSTRUMENTATION_OPTIONS,
  INSTRUMENT_TEXTURE_AXES,
  KEY_OPTIONS,
  MELODY_CHARACTER_OPTIONS,
  MOOD_OPTIONS,
  PRIMARY_GENRES,
  PRODUCTION_AXES,
  PRODUCTION_OPTIONS,
  TEMPO_OPTIONS,
  TIME_SIGNATURE_OPTIONS,
  VOCAL_DIRECTION_OPTIONS,
  VOCAL_NEGATIVE_OPTIONS,
  AVOID_SUGGESTIONS,
  BPM_MIN,
  BPM_MAX,
  type InstrumentTextureAxes,
  type ProductionAxes,
} from "@/lib/style-studio-constants";
import AxisSlider from "@/components/style-studio/AxisSlider";
import TagInput from "@/components/ui/TagInput";
import { useT } from "@/hooks/useT";

function SearchableDropdown({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => (query ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase())) : options),
    [options, query]
  );
  const effectivePlaceholder = placeholder ?? t("melody.selectPlaceholder");

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-white/45 mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full input-field text-left text-sm flex items-center justify-between"
      >
        <span className={value ? "text-white" : "text-white/35"}>{value || effectivePlaceholder}</span>
        <svg className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/10 bg-[#1a1a24] shadow-2xl">
          <input
            type="text"
            placeholder={t("melody.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border-b border-white/10 rounded-t-lg text-sm placeholder-white/30 focus:outline-none focus:border-primary-500"
          />
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-white/40">{t("melody.noResults")}</p>
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
  bpm,
  setBpm,
  musicalKey,
  setMusicalKey,
  timeSignature,
  setTimeSignature,
  melodyCharacter,
  setMelodyCharacter,
  harmonyCharacter,
  setHarmonyCharacter,
  groove,
  setGroove,
  energy,
  setEnergy,
  instrumentTexture,
  setInstrumentTexture,
  vocalNegatives,
  setVocalNegatives,
  productionAxes,
  setProductionAxes,
  avoidTags,
  setAvoidTags,
  instrumental,
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
  bpm: number | null;
  setBpm: (v: number | null) => void;
  musicalKey: string;
  setMusicalKey: (v: string) => void;
  timeSignature: string;
  setTimeSignature: (v: string) => void;
  melodyCharacter: string[];
  setMelodyCharacter: (v: string[]) => void;
  harmonyCharacter: string[];
  setHarmonyCharacter: (v: string[]) => void;
  groove: string[];
  setGroove: (v: string[]) => void;
  energy: number;
  setEnergy: (v: number) => void;
  instrumentTexture: InstrumentTextureAxes;
  setInstrumentTexture: (v: InstrumentTextureAxes) => void;
  vocalNegatives: string[];
  setVocalNegatives: (v: string[]) => void;
  productionAxes: ProductionAxes;
  setProductionAxes: (v: ProductionAxes) => void;
  avoidTags: string[];
  setAvoidTags: (v: string[]) => void;
  instrumental: boolean;
}) {
  const t = useT();
  function toggleIn(list: string[], setter: (v: string[]) => void, value: string) {
    if (list.includes(value)) {
      setter(list.filter((v) => v !== value));
    } else {
      setter([...list, value]);
    }
  }

  return (
    <div className="space-y-5">
      {/* Musical Foundation */}
      <section className="rounded-2xl border border-white/10 bg-[#101018]/80 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-white/85">{t("melody.musicalFoundationHeading")}</h3>

        <SearchableDropdown label={t("melody.primaryGenreLabel")} value={primaryGenre} options={PRIMARY_GENRES} onChange={setPrimaryGenre} placeholder={t("melody.chooseGenrePlaceholder")} />
        <SearchableDropdown label={t("melody.secondaryGenreLabel")} value={secondaryGenre} options={PRIMARY_GENRES} onChange={setSecondaryGenre} placeholder={t("melody.optionalPlaceholder")} />
        <ChipGroup label={t("melody.moodLabel")} options={MOOD_OPTIONS} selected={moods} onToggle={(v) => toggleIn(moods, setMoods, v)} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">{t("melody.bpmLabel")}</label>
            <input
              type="number"
              min={BPM_MIN}
              max={BPM_MAX}
              value={bpm ?? ""}
              onChange={(e) => setBpm(e.target.value ? Number(e.target.value) : null)}
              placeholder={t("melody.bpmPlaceholder")}
              className="w-full input-field text-sm"
            />
          </div>
          <SearchableDropdown label={t("melody.timeSignatureLabel")} value={timeSignature} options={TIME_SIGNATURE_OPTIONS} onChange={setTimeSignature} placeholder="4/4" />
        </div>
        <SearchableDropdown label={t("melody.keyLabel")} value={musicalKey} options={KEY_OPTIONS} onChange={setMusicalKey} placeholder={t("melody.chooseKeyPlaceholder")} />

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

        <AxisSlider left={t("melody.lowEnergyLabel")} right={t("melody.highEnergyLabel")} value={energy} onChange={setEnergy} />

        <ChipGroup label={t("melody.melodyCharacterLabel")} options={MELODY_CHARACTER_OPTIONS} selected={melodyCharacter} onToggle={(v) => toggleIn(melodyCharacter, setMelodyCharacter, v)} />
        <ChipGroup label={t("melody.harmonyCharacterLabel")} options={HARMONY_CHARACTER_OPTIONS} selected={harmonyCharacter} onToggle={(v) => toggleIn(harmonyCharacter, setHarmonyCharacter, v)} />
        <ChipGroup label={t("melody.grooveLabel")} options={GROOVE_OPTIONS} selected={groove} onToggle={(v) => toggleIn(groove, setGroove, v)} />
      </section>

      {/* Instrumentation */}
      <section className="rounded-2xl border border-white/10 bg-[#101018]/80 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-white/85">{t("melody.instrumentationHeading")}</h3>
        <ChipGroup label={t("melody.instrumentsLabel")} options={INSTRUMENTATION_OPTIONS} selected={instrumentation} onToggle={(v) => toggleIn(instrumentation, setInstrumentation, v)} />
        <div className="space-y-3">
          {INSTRUMENT_TEXTURE_AXES.map((axis) => (
            <AxisSlider
              key={axis.key}
              left={axis.left}
              right={axis.right}
              value={instrumentTexture[axis.key]}
              onChange={(v) => setInstrumentTexture({ ...instrumentTexture, [axis.key]: v })}
            />
          ))}
        </div>
      </section>

      {/* Vocals — hidden for instrumental tracks */}
      {!instrumental && (
        <section className="rounded-2xl border border-white/10 bg-[#101018]/80 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white/85">{t("melody.vocalsHeading")}</h3>
          <ChipGroup label={t("melody.vocalDeliveryLabel")} options={VOCAL_DIRECTION_OPTIONS} selected={vocalDirection} onToggle={(v) => toggleIn(vocalDirection, setVocalDirection, v)} />
          <div>
            <label className="block text-xs font-medium text-white/45 mb-2">{t("melody.avoidVocalLabel")}</label>
            <TagInput value={vocalNegatives} onChange={setVocalNegatives} suggestions={VOCAL_NEGATIVE_OPTIONS} placeholder={t("melody.noBeltingPlaceholder")} />
          </div>
        </section>
      )}

      {/* Production */}
      <section className="rounded-2xl border border-white/10 bg-[#101018]/80 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-white/85">{t("melody.productionHeading")}</h3>
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
        <ChipGroup label={t("melody.productionCharacterLabel")} options={PRODUCTION_OPTIONS} selected={production} onToggle={(v) => toggleIn(production, setProduction, v)} />
        <div className="space-y-3">
          {PRODUCTION_AXES.map((axis) => (
            <AxisSlider
              key={axis.key}
              left={axis.left}
              right={axis.right}
              value={productionAxes[axis.key]}
              onChange={(v) => setProductionAxes({ ...productionAxes, [axis.key]: v })}
            />
          ))}
        </div>
      </section>

      {/* Avoid */}
      <section className="rounded-2xl border border-white/10 bg-[#101018]/80 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-white/85">{t("melody.avoidHeading")}</h3>
        <p className="text-xs text-white/40">{t("melody.avoidHintText")}</p>
        <TagInput value={avoidTags} onChange={setAvoidTags} suggestions={AVOID_SUGGESTIONS} placeholder={t("melody.avoidTagsPlaceholder")} />
      </section>
    </div>
  );
}
