"use client";

import Link from "next/link";

import { resolveArtistSlug, useArtistSlugMap } from "@/hooks/useArtistSlugMap";

interface ArtistLinkProps {
  /** Artist name to display (release.artistName, track.artistName, ...). */
  name?: string | null;
  /** Skip the lookup when the caller already knows the slug (or its absence). */
  slug?: string | null;
  /** Where to link when there is no artist page (e.g. /discover/artist/[id]). */
  fallbackHref?: string | null;
  className?: string;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}

/**
 * Artist name that links to /artist/[slug] when the artist has an artist
 * page, and renders as plain text otherwise. Use everywhere an artist name
 * is shown so pages stay clickable without dead links.
 */
export default function ArtistLink({ name, slug, fallbackHref, className, title, onClick, onDoubleClick }: ArtistLinkProps) {
  const slugMap = useArtistSlugMap();
  const label = (name ?? "").trim();
  if (!label) return null;

  const resolvedSlug = slug !== undefined ? slug : resolveArtistSlug(slugMap, label);
  if (!resolvedSlug) {
    if (fallbackHref) {
      return (
        <Link
          href={fallbackHref}
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
