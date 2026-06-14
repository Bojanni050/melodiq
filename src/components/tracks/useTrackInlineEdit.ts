"use client";

import { useEffect, useRef, useState } from "react";
import type { TrackItem } from "./types";

export function useTrackInlineEdit(track: TrackItem, onTitleUpdate?: (trackId: string, newTitle: string) => void) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(track.title ? track.title.replace(/\s*\(2\)\s*$/, "") : "");
  const [isEditingArtist, setIsEditingArtist] = useState(false);
  const [editArtist, setEditArtist] = useState(track.artistName ?? "");
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const artistInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (isEditingArtist && artistInputRef.current) {
      artistInputRef.current.focus();
      artistInputRef.current.select();
    }
  }, [isEditingArtist]);

  useEffect(() => {
    if (!isEditingArtist) setEditArtist(track.artistName ?? "");
  }, [track.artistName, isEditingArtist]);

  function saveTitle() {
    const trimmed = editTitle.trim();
    setIsEditingTitle(false);
    if (!trimmed || trimmed === track.title) return;
    onTitleUpdate?.(track.id, trimmed);
    fetch(`/api/tracks/${track.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    }).catch(() => {});
  }

  function discardTitle() {
    setIsEditingTitle(false);
    setEditTitle(track.title ? track.title.replace(/\s*\(2\)\s*$/, "") : "");
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); saveTitle(); }
    else if (e.key === "Escape") { discardTitle(); }
  }

  function handleTitleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setIsEditingTitle(true);
    setEditTitle(track.title ? track.title.replace(/\s*\(2\)\s*$/, "") : track.prompt.substring(0, 50));
  }

  function saveArtist() {
    const trimmed = editArtist.trim();
    setIsEditingArtist(false);
    const next = trimmed || null;
    if (next === (track.artistName ?? null)) return;
    fetch(`/api/tracks/${track.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artistName: next }),
    }).catch(() => {});
  }

  function discardArtist() {
    setIsEditingArtist(false);
    setEditArtist(track.artistName ?? "");
  }

  function handleArtistKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); saveArtist(); }
    else if (e.key === "Escape") { discardArtist(); }
  }

  return {
    isEditingTitle, setIsEditingTitle, editTitle, setEditTitle, titleInputRef,
    saveTitle, discardTitle, handleTitleKeyDown, handleTitleDoubleClick,
    isEditingArtist, setIsEditingArtist, editArtist, setEditArtist, artistInputRef,
    saveArtist, discardArtist, handleArtistKeyDown,
  };
}
