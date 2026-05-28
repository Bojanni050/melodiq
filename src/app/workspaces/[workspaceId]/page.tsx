"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TrackList from "@/components/TrackList";
import { getWorkspaceCoverCollage } from "@/lib/track-utils";
import { DEFAULT_WORKSPACE_ID, usePlayerStore, usePlaylistStore, useWorkspaceStore } from "@/lib/store";

type Track = {
  id: string;
  title: string | null;
  provider: string;
  providerModel: string;
  prompt: string;
  lyrics: string | null;
  status: "pending" | "generating" | "done" | "failed";
  audioUrl: string | null;
  audioUrlHd: string | null;
  format: string | null;
  formatHd: string | null;
  duration: number | null;
  createdAt: string;
  error: string | null;
  s3KeyHd: string | null;
  coverUrl: string | null;
  s3KeyCover: string | null;
};

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const SWATCH_COLORS = [
  "bg-violet-600",
  "bg-sky-500",
  "bg-orange-500",
  "bg-emerald-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-indigo-500",
  "bg-teal-500",
] as const;

function getWorkspaceSwatchClass(workspaceId: string) {
  return SWATCH_COLORS[hashString(workspaceId) % SWATCH_COLORS.length];
}

export default function WorkspaceDetailPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const workspaceId = params?.workspaceId;

  const { currentTrack } = usePlayerStore();
  const { playlists, addTrackToPlaylist } = usePlaylistStore();
  const {
    workspaces,
    setSelectedWorkspaceId,
    createWorkspaceFolder,
    deleteWorkspace,
    hydrateWorkspacesFromServer,
  } = useWorkspaceStore();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      setSelectedWorkspaceId(workspaceId);
    }
  }, [setSelectedWorkspaceId, workspaceId]);

  useEffect(() => {
    let active = true;

    async function fetchTracks() {
      const res = await fetch("/api/tracks");
      if (!active) return;

      if (res.ok) {
        const data = await res.json();
        setTracks((data.tracks || []).filter((track: Track) => track.status === "done"));
        if (Array.isArray(data.workspaces)) {
          hydrateWorkspacesFromServer(data.workspaces);
        }
      }

      setLoading(false);
    }

    fetchTracks();

    return () => {
      active = false;
    };
  }, []);

  const selectedWorkspace = useMemo(
    () => (workspaceId ? workspaces.find((workspace) => workspace.id === workspaceId) ?? null : null),
    [workspaceId, workspaces],
  );

  const childWorkspacesByParent = useMemo(() => {
    const grouped = new Map<string, typeof workspaces>();
    workspaces
      .filter((workspace) => Boolean(workspace.parentWorkspaceId))
      .forEach((workspace) => {
        const parentId = workspace.parentWorkspaceId as string;
        const list = grouped.get(parentId) ?? [];
        grouped.set(parentId, [...list, workspace]);
      });
    return grouped;
  }, [workspaces]);

  const selectedWorkspaceChildren = useMemo(() => {
    if (!selectedWorkspace) return [];
    return childWorkspacesByParent.get(selectedWorkspace.id) ?? [];
  }, [childWorkspacesByParent, selectedWorkspace]);

  const selectedWorkspaceParent = useMemo(() => {
    if (!selectedWorkspace?.parentWorkspaceId) return null;
    return (
      workspaces.find((workspace) => workspace.id === selectedWorkspace.parentWorkspaceId) ?? null
    );
  }, [selectedWorkspace, workspaces]);

  const selectedWorkspaceTracks = useMemo(
    () => (selectedWorkspace ? tracks.filter((track) => selectedWorkspace.trackIds.includes(track.id)) : []),
    [selectedWorkspace, tracks],
  );

  const defaultSortedWorkspaceTracks = useMemo(() => {
    const list = [...selectedWorkspaceTracks];
    list.sort((left, right) => {
      const leftTime = Number(new Date(left.createdAt));
      const rightTime = Number(new Date(right.createdAt));
      if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
      return rightTime - leftTime;
    });
    return list;
  }, [selectedWorkspaceTracks]);

  const headerCoverUrl = useMemo(() => {
    const coverUrlForTrack = (track: { id: string; coverUrl?: string | null; s3KeyCover?: string | null } | null) =>
      track?.coverUrl || (track?.s3KeyCover ? `/api/tracks/${track.id}/cover` : null);

    const firstTrack = defaultSortedWorkspaceTracks[0] ?? null;

    if (currentTrack && selectedWorkspace?.trackIds.includes(currentTrack.id)) {
      return coverUrlForTrack(currentTrack);
    }

    return coverUrlForTrack(firstTrack);
  }, [currentTrack, defaultSortedWorkspaceTracks, selectedWorkspace?.trackIds]);

  function backToFolderView() {
    if (selectedWorkspaceParent) {
      router.push(`/workspaces/${selectedWorkspaceParent.id}`);
      return;
    }

    router.push("/workspaces");
  }

  function openWorkspace(nextWorkspaceId: string) {
    setSelectedWorkspaceId(nextWorkspaceId);
    router.push(`/workspaces/${nextWorkspaceId}`);
  }

  function handleCreateFolder() {
    if (!selectedWorkspace || selectedWorkspace.parentWorkspaceId) return;
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    const folderId = createWorkspaceFolder(selectedWorkspace.id, trimmed);
    if (!folderId) return;

    setNewFolderName("");
    setShowCreateFolder(false);
    openWorkspace(folderId);
  }

  function handleDeleteTrack(trackId: string) {
    setTracks((current) => current.filter((track) => track.id !== trackId));
  }

  if (!selectedWorkspace) {
    return (
      <div className="h-screen bg-[#09090d] overflow-hidden text-white">
        <Sidebar credits={null} />
        <div className="lg:ml-60 h-[calc(100vh-var(--player-height))] flex items-center justify-center px-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-sm text-white/70">Workspace not found.</p>
            <button
              type="button"
              onClick={() => router.push("/workspaces")}
              className="mt-4 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/12 hover:text-white"
            >
              Back to folders
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#09090d] overflow-hidden text-white">
      <Sidebar credits={null} />

      <div className="lg:ml-60 h-[calc(100vh-var(--player-height))] flex flex-col">
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24">
          <div className="max-w-[1600px] mx-auto space-y-6">
            <section className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_35%),linear-gradient(135deg,#11111a_0%,#0b0b11_100%)] p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              {headerCoverUrl ? (
                <div aria-hidden="true" className="absolute inset-0">
                  <img
                    src={headerCoverUrl}
                    alt=""
                    className="h-full w-full object-cover scale-125 blur-2xl opacity-55"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_45%),linear-gradient(135deg,rgba(9,9,13,0.35)_0%,rgba(9,9,13,0.86)_70%,rgba(9,9,13,0.98)_100%)]" />
                </div>
              ) : null}

              <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={backToFolderView}
                    className="mb-2 inline-flex items-center gap-1.5 text-sm text-white/55 transition-colors hover:text-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to folders
                  </button>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/35">Workspace</p>
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight truncate">{selectedWorkspace.name}</h1>
                  <p className="text-sm text-white/60 mt-1">
                    {selectedWorkspaceTracks.length} songs in this folder.
                  </p>
                </div>

                {selectedWorkspace.id === DEFAULT_WORKSPACE_ID ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/45">Default workspace</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      deleteWorkspace(selectedWorkspace.id);
                      router.push("/workspaces");
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition-colors hover:bg-red-500/10 hover:text-red-200"
                  >
                    Delete workspace
                  </button>
                )}
              </div>
            </section>

            {!selectedWorkspace.parentWorkspaceId && (
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Subfolders</h2>
                  {showCreateFolder ? (
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1.5">
                      <input
                        value={newFolderName}
                        onChange={(event) => setNewFolderName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") handleCreateFolder();
                          if (event.key === "Escape") {
                            setShowCreateFolder(false);
                            setNewFolderName("");
                          }
                        }}
                        placeholder="Subfolder name"
                        className="h-9 w-44 rounded-full bg-transparent px-3 text-sm text-white placeholder:text-white/30 outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleCreateFolder}
                        className="h-9 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateFolder(false);
                          setNewFolderName("");
                        }}
                        className="h-9 rounded-full px-4 text-sm text-white/60 transition-colors hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCreateFolder(true)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      + Add subfolder
                    </button>
                  )}
                </div>

                {selectedWorkspaceChildren.length > 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="space-y-1.5">
                      {selectedWorkspaceChildren.map((childWorkspace) => {
                        const childTracks = tracks.filter((track) => childWorkspace.trackIds.includes(track.id));
                        const childCover = getWorkspaceCoverCollage(childWorkspace.id, childTracks)[0];
                        return (
                          <button
                            key={childWorkspace.id}
                            type="button"
                            onClick={() => openWorkspace(childWorkspace.id)}
                            className="group flex w-full items-center gap-3 rounded-xl border border-white/8 bg-[#0f1017] px-3 py-2 text-left transition-colors hover:bg-white/4"
                          >
                            <div className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-lg ${getWorkspaceSwatchClass(childWorkspace.id)}`}>
                              {childCover ? (
                                <img src={childCover} alt={childWorkspace.name} loading="lazy" className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-white">{childWorkspace.name}</p>
                            </div>
                            <span className="text-xs text-white/45">{childTracks.length} songs</span>
                            <svg className="h-4 w-4 shrink-0 text-white/20 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-5 text-sm text-white/55">
                    No subfolders yet.
                  </div>
                )}
              </section>
            )}

            <section className="space-y-4">
              <h2 className="text-base font-semibold">Tracks</h2>
              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">Loading tracks...</div>
              ) : selectedWorkspaceTracks.length > 0 ? (
                <TrackList
                  tracks={selectedWorkspaceTracks}
                  autoQueueAfterPlay
                  onSelect={() => undefined}
                  onDelete={handleDeleteTrack}
                  onAddToPlaylist={(trackId, playlistId, options) => addTrackToPlaylist(playlistId, trackId, options)}
                  playlists={playlists.map((playlist) => ({ id: playlist.id, name: playlist.name }))}
                  onTitleUpdate={(trackId, newTitle) =>
                    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, title: newTitle } : t)))
                  }
                />
              ) : (
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.03] p-8 text-sm text-white/55">
                  This workspace has no songs yet. Use track actions and choose Move To Workspace.
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
