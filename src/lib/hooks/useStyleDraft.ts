"use client";

import { useCallback, useEffect, useState } from "react";
import {
  STYLE_STORAGE_KEY,
  DEFAULT_INSTRUMENT_TEXTURE_AXES,
  DEFAULT_PRODUCTION_AXES,
  type InstrumentTextureAxes,
  type ProductionAxes,
  type StyleDraftPayload,
} from "@/lib/style-studio-constants";
import {
  buildStyleDraftPayload,
  parseSavedStyleSnapshots,
  saveStyleSnapshotsToStorage,
} from "@/lib/style-studio-draft";
import { STYLE_SNAPSHOTS_KEY } from "@/lib/style-studio-constants";
import type { StyleSnapshot } from "@/lib/style-studio-types";

const EMPTY_PAYLOAD: StyleDraftPayload = {
  primaryGenre: "",
  secondaryGenre: "",
  moods: [],
  instrumentation: [],
  vocalDirection: [],
  tempo: "",
  era: "",
  production: [],
  bpm: null,
  musicalKey: "",
  timeSignature: "",
  melodyCharacter: [],
  harmonyCharacter: [],
  groove: [],
  energy: 50,
  instrumentTexture: { ...DEFAULT_INSTRUMENT_TEXTURE_AXES },
  vocalNegatives: [],
  productionAxes: { ...DEFAULT_PRODUCTION_AXES },
  avoidTags: [],
};

function sanitizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function sanitizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeAxes<T extends Record<string, number>>(value: unknown, defaults: T): T {
  if (!value || typeof value !== "object") return { ...defaults };
  const obj = value as Record<string, unknown>;
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const raw = obj[key as string];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      result[key] = Math.min(100, Math.max(0, raw)) as T[keyof T];
    }
  }
  return result;
}

function sanitizePayload(parsed: unknown): StyleDraftPayload {
  if (!parsed || typeof parsed !== "object") return { ...EMPTY_PAYLOAD };
  const obj = parsed as Record<string, unknown>;
  return {
    primaryGenre: sanitizeString(obj.primaryGenre),
    secondaryGenre: sanitizeString(obj.secondaryGenre),
    moods: sanitizeStringArray(obj.moods),
    instrumentation: sanitizeStringArray(obj.instrumentation),
    vocalDirection: sanitizeStringArray(obj.vocalDirection),
    tempo: sanitizeString(obj.tempo),
    era: sanitizeString(obj.era),
    production: sanitizeStringArray(obj.production),
    bpm: typeof obj.bpm === "number" && Number.isFinite(obj.bpm) ? obj.bpm : null,
    musicalKey: sanitizeString(obj.musicalKey),
    timeSignature: sanitizeString(obj.timeSignature),
    melodyCharacter: sanitizeStringArray(obj.melodyCharacter),
    harmonyCharacter: sanitizeStringArray(obj.harmonyCharacter),
    groove: sanitizeStringArray(obj.groove),
    energy: sanitizeNumber(obj.energy, 50),
    instrumentTexture: sanitizeAxes<InstrumentTextureAxes>(obj.instrumentTexture, DEFAULT_INSTRUMENT_TEXTURE_AXES),
    vocalNegatives: sanitizeStringArray(obj.vocalNegatives),
    productionAxes: sanitizeAxes<ProductionAxes>(obj.productionAxes, DEFAULT_PRODUCTION_AXES),
    avoidTags: sanitizeStringArray(obj.avoidTags),
  };
}

export function useStyleDraft() {
  const [primaryGenre, setPrimaryGenre] = useState("");
  const [secondaryGenre, setSecondaryGenre] = useState("");
  const [moods, setMoods] = useState<string[]>([]);
  const [instrumentation, setInstrumentation] = useState<string[]>([]);
  const [vocalDirection, setVocalDirection] = useState<string[]>([]);
  const [tempo, setTempo] = useState("");
  const [era, setEra] = useState("");
  const [production, setProduction] = useState<string[]>([]);

  const [bpm, setBpm] = useState<number | null>(null);
  const [musicalKey, setMusicalKey] = useState("");
  const [timeSignature, setTimeSignature] = useState("");
  const [melodyCharacter, setMelodyCharacter] = useState<string[]>([]);
  const [harmonyCharacter, setHarmonyCharacter] = useState<string[]>([]);
  const [groove, setGroove] = useState<string[]>([]);
  const [energy, setEnergy] = useState(50);
  const [instrumentTexture, setInstrumentTexture] = useState<InstrumentTextureAxes>({ ...DEFAULT_INSTRUMENT_TEXTURE_AXES });
  const [vocalNegatives, setVocalNegatives] = useState<string[]>([]);
  const [productionAxes, setProductionAxes] = useState<ProductionAxes>({ ...DEFAULT_PRODUCTION_AXES });
  const [avoidTags, setAvoidTags] = useState<string[]>([]);

  const [savedSnapshots, setSavedSnapshots] = useState<StyleSnapshot[]>([]);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STYLE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const sanitized = sanitizePayload(parsed);
        setPrimaryGenre(sanitized.primaryGenre);
        setSecondaryGenre(sanitized.secondaryGenre);
        setMoods(sanitized.moods);
        setInstrumentation(sanitized.instrumentation);
        setVocalDirection(sanitized.vocalDirection);
        setTempo(sanitized.tempo);
        setEra(sanitized.era);
        setProduction(sanitized.production);
        setBpm(sanitized.bpm);
        setMusicalKey(sanitized.musicalKey);
        setTimeSignature(sanitized.timeSignature);
        setMelodyCharacter(sanitized.melodyCharacter);
        setHarmonyCharacter(sanitized.harmonyCharacter);
        setGroove(sanitized.groove);
        setEnergy(sanitized.energy);
        setInstrumentTexture(sanitized.instrumentTexture);
        setVocalNegatives(sanitized.vocalNegatives);
        setProductionAxes(sanitized.productionAxes);
        setAvoidTags(sanitized.avoidTags);
      }
    } catch (error) {
      console.error("Failed to restore style draft", error);
      window.localStorage.removeItem(STYLE_STORAGE_KEY);
    }

    const snapshotsRaw = typeof window !== "undefined" ? window.localStorage.getItem(STYLE_SNAPSHOTS_KEY) : null;
    setSavedSnapshots(parseSavedStyleSnapshots(snapshotsRaw));

    setHasRestoredDraft(true);
  }, []);

  useEffect(() => {
    if (!hasRestoredDraft) return;
    const payload = buildStyleDraftPayload({
      primaryGenre,
      secondaryGenre,
      moods,
      instrumentation,
      vocalDirection,
      tempo,
      era,
      production,
      bpm,
      musicalKey,
      timeSignature,
      melodyCharacter,
      harmonyCharacter,
      groove,
      energy,
      instrumentTexture,
      vocalNegatives,
      productionAxes,
      avoidTags,
    });
    try {
      window.localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to persist style draft", error);
    }
  }, [
    hasRestoredDraft,
    primaryGenre,
    secondaryGenre,
    moods,
    instrumentation,
    vocalDirection,
    tempo,
    era,
    production,
    bpm,
    musicalKey,
    timeSignature,
    melodyCharacter,
    harmonyCharacter,
    groove,
    energy,
    instrumentTexture,
    vocalNegatives,
    productionAxes,
    avoidTags,
  ]);

  const saveSnapshotsToStorage = useCallback((snapshots: StyleSnapshot[]) => {
    setSavedSnapshots(snapshots);
    saveStyleSnapshotsToStorage(snapshots);
  }, []);

  const loadSnapshotIntoState = useCallback((snapshot: StyleSnapshot) => {
    const sanitized = sanitizePayload(snapshot.payload);
    setPrimaryGenre(sanitized.primaryGenre);
    setSecondaryGenre(sanitized.secondaryGenre);
    setMoods(sanitized.moods);
    setInstrumentation(sanitized.instrumentation);
    setVocalDirection(sanitized.vocalDirection);
    setTempo(sanitized.tempo);
    setEra(sanitized.era);
    setProduction(sanitized.production);
    setBpm(sanitized.bpm);
    setMusicalKey(sanitized.musicalKey);
    setTimeSignature(sanitized.timeSignature);
    setMelodyCharacter(sanitized.melodyCharacter);
    setHarmonyCharacter(sanitized.harmonyCharacter);
    setGroove(sanitized.groove);
    setEnergy(sanitized.energy);
    setInstrumentTexture(sanitized.instrumentTexture);
    setVocalNegatives(sanitized.vocalNegatives);
    setProductionAxes(sanitized.productionAxes);
    setAvoidTags(sanitized.avoidTags);
  }, []);

  return {
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
    savedSnapshots,
    setSavedSnapshots: saveSnapshotsToStorage,
    loadSnapshotIntoState,
  };
}
