"use client";

import { useEffect, useState } from "react";

type ArtistListRow = { alias: string; slug: string };

let cachedMap: Map<string, string> | null = null;
let cachedPromise: Promise<Map<string, string>> | null = null;

function buildMap(rows: ArtistListRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const key = row.alias.trim().toLowerCase();
    if (key && row.slug && !map.has(key)) map.set(key, row.slug);
  }
  return map;
}

async function fetchArtistSlugMap(): Promise<Map<string, string>> {
  if (cachedMap) return cachedMap;
  if (cachedPromise) return cachedPromise;
  cachedPromise = fetch("/api/artists", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) return new Map<string, string>();
      const data = await res.json().catch(() => null);
      const rows: ArtistListRow[] = Array.isArray(data?.artists) ? data.artists : [];
      cachedMap = buildMap(rows);
      return cachedMap;
    })
    .catch(() => new Map<string, string>());
  return cachedPromise;
}

/**
 * Lowercased artist alias -> public page slug, shared across the app so every
 * artist name can link to /artist/[slug] when a page exists. Module-level
 * cache keeps it to one request per session.
 */
export function useArtistSlugMap(): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(() => cachedMap ?? new Map());

  useEffect(() => {
    let active = true;
    void fetchArtistSlugMap().then((next) => {
      if (active) setMap(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return map;
}

/** Slug for one artist name, or null when there is no artist page for it. */
export function resolveArtistSlug(map: Map<string, string>, name: string | null | undefined): string | null {
  if (!name) return null;
  return map.get(name.trim().toLowerCase()) ?? null;
}
