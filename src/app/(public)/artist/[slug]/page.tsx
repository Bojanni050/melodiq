"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import ArtistPublicPage, {
  type PublicArtist,
  type PublicArtistTrack,
} from "@/components/artist/ArtistPublicPage";

// Public page for one artist alias: /artist/[slug]. All fetching is
// client-side (same as /discover/artist/[userId]) so the shared component can
// own the player store wiring.
export default function ArtistSlugPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [artist, setArtist] = useState<PublicArtist | null>(null);
  const [tracks, setTracks] = useState<PublicArtistTrack[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    async function fetchArtist() {
      const res = await fetch(`/api/artist/${slug}`);
      if (!active) return;
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setArtist(data.artist);
        setTracks(data.tracks ?? []);
      }
      setLoading(false);
    }
    fetchArtist();
    return () => {
      active = false;
    };
  }, [slug]);

  return <ArtistPublicPage artist={artist} tracks={tracks} loading={loading} notFound={notFound} />;
}
