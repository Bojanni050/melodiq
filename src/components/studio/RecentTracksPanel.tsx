import TrackList from "@/components/TrackList";
import type { Track } from "@/hooks/useTrackManager";

interface RecentTracksPanelProps {
  tracks: Track[];
  isGenerating: boolean;
  onSelect: (track: Track) => void;
  onDelete: (trackId: string) => void;
  onReusePrompt: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (trackId: string, playlistId: string, options?: { allowDuplicate?: boolean }) => void;
  onMoveToWorkspace: (trackId: string, workspaceId: string) => void;
  onTitleUpdate: (trackId: string, newTitle: string) => void;
  onEditDetails?: (track: Track) => void;
  playlists: { id: string; name: string }[];
}

export default function RecentTracksPanel({
  tracks,
  isGenerating,
  onSelect,
  onDelete,
  onReusePrompt,
  onAddToQueue,
  onAddToPlaylist,
  onMoveToWorkspace,
  onTitleUpdate,
  onEditDetails,
  playlists,
}: RecentTracksPanelProps) {
  return (
    <section className="section-card flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/60">Recent Tracks</h2>
        <span className="text-xs text-white/30">{tracks.length} tracks</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <TrackList
          tracks={tracks}
          enableDragReorder={false}
          autoQueueAfterPlay
          isGenerating={isGenerating}
          onSelect={onSelect}
          onDelete={onDelete}
          onReusePrompt={onReusePrompt}
          onAddToQueue={onAddToQueue}
          onAddToPlaylist={onAddToPlaylist}
          onMoveToWorkspace={onMoveToWorkspace}
          playlists={playlists}
          onTitleUpdate={onTitleUpdate}
          onEditDetails={onEditDetails}
        />
      </div>
    </section>
  );
}
