"use client";

import Link from "next/link";

import { resolveArtistSlug, useArtistSlugMap } from "@/hooks/useArtistSlugMap";

interface ArtistLinkProps {
  /** Artist name to display (release.artistName, track.artistName, ...). */
  name?: string | null;
  /** Skip the lookup when the caller already knows the slug (or its absence). */
  slug?: string | null;
  className?: string;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}

/**
 * Artist name that links to /artist/[slug] only when the artist actually has an
 * artist page, and renders as plain text otherwise. Use everywhere an artist
 * name is shown, so a name without a page never looks clickable (no fallback to
 * the per-account page).
 */
export default function ArtistLink({ name, slug, className, title, onClick, onDoubleClick }: ArtistLinkProps) {
  const slugMap = useArtistSlugMap();
  const label = (name ?? "").trim();
  if (!label) return null;

  const resolvedSlug = slug !== undefined ? slug : resolveArtistSlug(slugMap, label);
  if (!resolvedSlug) {
    return (
      <span className={className} title={title} onClick={onClick} onDoubleClick={onDoubleClick}>
        {label}
      </span>
    );
  }

  return (
    <Link
      href={`/artist/${resolvedSlug}`}
      className={className}
      title={title ?? label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(e);
      }}
    >
      {label}
    </Link>
  );
}
