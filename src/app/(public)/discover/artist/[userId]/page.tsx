"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import ArtistPublicPage, {
  type PublicArtist,
  type PublicArtistTrack,
} from "@/components/artist/ArtistPublicPage";

export default function DiscoverArtistPage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;

  const [artist, setArtist] = useState<PublicArtist | null>(null);
  const [tracks, setTracks] = useState<PublicArtistTrack[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    async function fetchArtist() {
      const res = await fetch(`/api/discover/artist/${userId}`);
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
  }, [userId]);

  return <ArtistPublicPage artist={artist} tracks={tracks} loading={loading} notFound={notFound} />;
}
