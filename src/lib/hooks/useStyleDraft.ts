"use client";

import { useCallback, useEffect, useState } from "react";
import { STYLE_STORAGE_KEY, type StyleDraftPayload } from "@/lib/style-studio-constants";
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
};

function sanitizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
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
    savedSnapshots,
    setSavedSnapshots: saveSnapshotsToStorage,
    loadSnapshotIntoState,
  };
}
