"use client";

import { useEffect, useRef, useState } from "react";
import type { Workspace } from "@/lib/store";
import type { TrackItem } from "@/components/tracks/types";

interface MoveToWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  track: TrackItem;
  orderedWorkspaceOptions: { workspace: Workspace; depth: number }[];
  workspaceCoverById: Map<string, string | null>;
  workspaceDisplayNameById: Map<string, string>;
  workspaces: Workspace[];
  onMoveToWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (workspaceName: string) => void;
  onMergeWorkspaceTrigger: (existingWorkspace: { id: string; name: string }) => void;
}

export default function MoveToWorkspaceDialog({
  isOpen,
  onClose,
  track,
  orderedWorkspaceOptions,
  workspaceCoverById,
  workspaceDisplayNameById,
  workspaces,
  onMoveToWorkspace,
  onCreateWorkspace,
  onMergeWorkspaceTrigger,
}: MoveToWorkspaceDialogProps) {
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [workspaceDraftOpen, setWorkspaceDraftOpen] = useState(false);
  const workspaceInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const suggestedName = (track.title || track.prompt || "").trim().replace(/\s*\(2\)\s*$/, "");
      setWorkspaceDraftOpen(false);
      if (suggestedName && !newWorkspaceName.trim()) {
        setNewWorkspaceName(suggestedName.slice(0, 100));
      }
    }
  }, [isOpen, track, newWorkspaceName]);

  useEffect(() => {
    if (workspaceDraftOpen && workspaceInputRef.current) {
      workspaceInputRef.current.focus();
    }
  }, [workspaceDraftOpen]);

  if (!isOpen) return null;

  const workspaceSwatches = [
    "bg-gradient-to-br from-orange-400 via-blue-500 to-indigo-700",
    "bg-gradient-to-br from-rose-300 via-red-500 to-purple-700",
    "bg-gradient-to-br from-emerald-300 via-lime-400 to-yellow-500",
    "bg-gradient-to-br from-sky-400 via-cyan-500 to-teal-700",
    "bg-gradient-to-br from-fuchsia-300 via-violet-500 to-blue-700",
  ];

  function handleCreateWorkspace() {
    const trimmed = newWorkspaceName.trim();
    if (!trimmed) return;

    const normalizedName = trimmed.toLowerCase();
    const existingWorkspace = workspaces.find(
      (w) => w.name.trim().toLowerCase() === normalizedName
    );

    if (existingWorkspace) {
      onMergeWorkspaceTrigger({ id: existingWorkspace.id, name: existingWorkspace.name });
      return;
    }

    onCreateWorkspace(trimmed);
    setNewWorkspaceName("");
    setWorkspaceDraftOpen(false);
  }

  function handleWorkspaceKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateWorkspace();
    } else if (e.key === "Escape") {
      if (workspaceDraftOpen) {
        setWorkspaceDraftOpen(false);
        setNewWorkspaceName("");
      } else {
        onClose();
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[520px] rounded-[28px] border border-white/10 bg-[#181822] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h3 className="text-xl leading-none font-medium text-white/90">Move to Workspace</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-11 rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close move to workspace menu"
          >
            <svg className="mx-auto h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="max-h-[380px] overflow-y-auto px-3 pb-2">
          <div className="space-y-1">
            {orderedWorkspaceOptions.map(({ workspace, depth }, index) => (
              <button
                key={workspace.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveToWorkspace(workspace.id);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white/85 transition-colors hover:bg-white/10"
              >
                {depth === 1 ? (
                  <span className="ml-2 shrink-0" title="Song">
                    <svg className="h-3.5 w-3.5 text-amber-300/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 17a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                ) : null}
                <div className={`h-11 w-11 shrink-0 overflow-hidden rounded-md ${workspaceSwatches[index % workspaceSwatches.length]}`}>
                  {workspaceCoverById.get(workspace.id) ? (
                    <img
                      src={workspaceCoverById.get(workspace.id) || ""}
                      alt={workspace.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <span
                  className={`min-w-0 flex-1 truncate leading-tight font-medium ${depth === 1 ? "text-[13px] text-white/75" : "text-base"}`}
                >
                  {workspaceDisplayNameById.get(workspace.id) ?? workspace.name}
                </span>
                <span className="shrink-0 text-xs text-white/60">
                  {workspace.trackIds.length} {depth === 1 ? "versions" : "clips"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 px-5 pb-4 pt-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                ref={workspaceInputRef}
                type="text"
                value={newWorkspaceName}
                onFocus={() => setWorkspaceDraftOpen(true)}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                onKeyDown={handleWorkspaceKeyDown}
                placeholder="Workspace name"
                className="h-12 w-full rounded-lg border border-white/70 bg-transparent px-3 pr-16 text-sm font-medium text-white placeholder:text-white/45 focus:outline-none focus:border-white"
                maxLength={100}
                aria-label="Workspace name"
              />
              <span className="pointer-events-none absolute bottom-2 right-2 text-xs text-white/45">{newWorkspaceName.length}/100</span>
            </div>
            <button
              type="button"
              onClick={handleCreateWorkspace}
              disabled={!newWorkspaceName.trim()}
              className="h-12 rounded-lg bg-white/8 px-5 text-sm font-medium text-white/90 transition-colors hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
