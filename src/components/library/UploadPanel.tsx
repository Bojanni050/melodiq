"use client";

import { useEffect, useRef, useState } from "react";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import SliderWithInput from "@/components/ui/SliderWithInput";
import {
  isObjectRecord,
  isSupportedAudioFile,
  formatFileSize,
  readApiPayload,
  titleFromUploadFilename,
  MAX_UPLOAD_QUEUE,
  UPLOAD_PROVIDERS,
  type LibraryTrack,
  type QueuedUploadItem,
} from "./types";

interface UploadPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceOptions: { id: string; label: string }[];
  defaultWorkspaceId: string;
  knownArtistNames: string[];
  knownComposerNames: string[];
  knownWriterNames: string[];
  onUploadFinished: (uploadedTracks: LibraryTrack[], workspaceId: string) => void;
}

export default function UploadPanel({
  isOpen,
  onClose,
  workspaceOptions,
  defaultWorkspaceId,
  knownArtistNames,
  knownComposerNames,
  knownWriterNames,
  onUploadFinished,
}: UploadPanelProps) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const uploadMetadataInputRef = useRef<HTMLInputElement | null>(null);
  const uploadLicenseInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadWorkspaceId, setUploadWorkspaceId] = useState<string>(defaultWorkspaceId);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [rejectedFiles, setRejectedFiles] = useState<Array<{ filename: string; reason: string }>>([]);
  const [isUploadDropzoneActive, setIsUploadDropzoneActive] = useState(false);
  const [queuedUploads, setQueuedUploads] = useState<QueuedUploadItem[]>([]);
  const [pendingMetadataTargetId, setPendingMetadataTargetId] = useState<string | null>(null);
  const [pendingLicenseTargetId, setPendingLicenseTargetId] = useState<string | null>(null);
  const [uploadPromptDraft, setUploadPromptDraft] = useState("");
  const [uploadLyricsDraft, setUploadLyricsDraft] = useState("");
  const [uploadInstrumental, setUploadInstrumental] = useState(false);

  useEffect(() => {
    setUploadWorkspaceId((current) => {
      if (current && workspaceOptions.some((workspace) => workspace.id === current)) return current;
      return defaultWorkspaceId;
    });
  }, [defaultWorkspaceId, workspaceOptions]);

  if (!isOpen) return null;

  function handleQueueAudioSelection(files: FileList | null) {
    if (!files || files.length === 0 || uploading) return;

    const incoming = Array.from(files);
    const invalid = incoming.filter((file) => !isSupportedAudioFile(file));
    const valid = incoming.filter((file) => isSupportedAudioFile(file));

    if (invalid.length > 0) {
      setRejectedFiles((current) => [
        ...current,
        ...invalid.map((file) => ({ filename: file.name, reason: "Only MP3 and WAV files are supported." })),
      ]);
    }

    setQueuedUploads((current) => {
      const room = Math.max(0, MAX_UPLOAD_QUEUE - current.length);
      const accepted = valid.slice(0, room).map((file) => ({
        id: typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        title: titleFromUploadFilename(file.name),
        artistName: "",
        composerName: "",
        writerName: "",
        coverFile: null,
        metadataFile: null,
        prompt: uploadPromptDraft,
        lyrics: uploadLyricsDraft,
        instrumental: uploadInstrumental,
        sourceProvider: "upload",
        sunoStyleInfluence: 50,
        sunoWeirdness: 50,
        licenseFile: null,
      }));

      if (valid.length > room) {
        setUploadError(`Queue limit reached. Maximum ${MAX_UPLOAD_QUEUE} files per upload batch.`);
      }

      return [...current, ...accepted];
    });

    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }

  function handleMetadataAttachSelection(files: FileList | null) {
    if (!pendingMetadataTargetId || !files || files.length === 0) return;
    const file = files[0];

    const normalizedName = file.name.toLowerCase();
    if (!normalizedName.endsWith(".txt") && !normalizedName.endsWith(".lrc")) {
      setUploadError("Metadata file must be a .txt or .lrc file.");
      return;
    }

    setQueuedUploads((current) =>
      current.map((item) =>
        item.id === pendingMetadataTargetId
          ? { ...item, metadataFile: file }
          : item
      )
    );
    setPendingMetadataTargetId(null);

    if (uploadMetadataInputRef.current) {
      uploadMetadataInputRef.current.value = "";
    }
  }

  function handleLicenseAttachSelection(files: FileList | null) {
    if (!pendingLicenseTargetId || !files || files.length === 0) return;
    const file = files[0];

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setUploadError("License file must be a PDF.");
      return;
    }

    setQueuedUploads((current) =>
      current.map((item) =>
        item.id === pendingLicenseTargetId ? { ...item, licenseFile: file } : item
      )
    );
    setPendingLicenseTargetId(null);

    if (uploadLicenseInputRef.current) {
      uploadLicenseInputRef.current.value = "";
    }
  }

  function handleUploadDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsUploadDropzoneActive(false);

    if (uploading) return;
    handleQueueAudioSelection(event.dataTransfer.files);
  }

  function handleUploadDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    if (!uploading) {
      setIsUploadDropzoneActive(true);
    }
  }

  function handleUploadDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
      return;
    }

    setIsUploadDropzoneActive(false);
  }

  async function handleStartUpload() {
    if (queuedUploads.length === 0 || uploading) return;

    const targetWorkspaceId = workspaceOptions.some((workspace) => workspace.id === uploadWorkspaceId)
      ? uploadWorkspaceId
      : defaultWorkspaceId;

    setUploading(true);
    setUploadError(null);
    setUploadNotice(null);
    setRejectedFiles([]);

    try {
      const formData = new FormData();
      queuedUploads.forEach((item, index) => {
        formData.append("files", item.file);
        if (item.metadataFile) {
          formData.append(`metadataFile:${index}`, item.metadataFile);
        }
        if (item.coverFile) {
          formData.append(`coverFile:${index}`, item.coverFile);
        }
        if (item.licenseFile) {
          formData.append(`licenseFile:${index}`, item.licenseFile);
        }
      });

      formData.append(
        "uploadItems",
        JSON.stringify(
          queuedUploads.map((item) => ({
            title: item.title.trim() || null,
            artistName: item.artistName.trim() || null,
            composerName: item.composerName.trim() || null,
            writerName: item.writerName.trim() || null,
            prompt: item.prompt.trim() || null,
            lyrics: item.instrumental ? null : (item.lyrics.trim() || null),
            instrumental: item.instrumental,
            sourceProvider: item.sourceProvider || null,
            sunoStyleInfluence: item.sourceProvider === "suno" ? item.sunoStyleInfluence : null,
            sunoWeirdness: item.sourceProvider === "suno" ? item.sunoWeirdness : null,
          }))
        )
      );

      formData.append("workspaceId", targetWorkspaceId);

      const response = await fetch("/api/tracks", {
        method: "POST",
        body: formData,
      });

      const payload = await readApiPayload(response);

      const payloadRejected = isObjectRecord(payload) && Array.isArray(payload.rejected)
        ? (payload.rejected as Array<{ filename: string; reason: string }>)
        : [];

      if (payloadRejected.length > 0) {
        setRejectedFiles(payloadRejected);
      }

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error("Upload is too large. Try fewer files or smaller files.");
        }

        const apiError = isObjectRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : null;
        const apiDetails = isObjectRecord(payload) && typeof payload.details === "string"
          ? payload.details
          : null;

        if (apiError) {
          throw new Error(apiDetails ? `${apiError} (${apiDetails})` : apiError);
        }

        throw new Error(`Upload failed (HTTP ${response.status}).`);
      }

      if (!isObjectRecord(payload)) {
        throw new Error("Upload failed: invalid server response.");
      }

      const uploadedTracks: LibraryTrack[] = (Array.isArray(payload.tracks) ? payload.tracks : []).filter(
        (track: LibraryTrack) => track.status === "done",
      );

      if (uploadedTracks.length > 0) {
        setQueuedUploads([]);
      }

      const rejectedCount = payloadRejected.length;
      if (uploadedTracks.length > 0) {
        setUploadNotice(
          rejectedCount > 0
            ? `Uploaded ${uploadedTracks.length} file(s) successfully, but ${rejectedCount} file(s) were skipped.`
            : `Uploaded ${uploadedTracks.length} file(s) successfully.`
        );
      } else {
        setUploadError("No files were uploaded successfully.");
      }

      onUploadFinished(uploadedTracks, targetWorkspaceId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-70">
      <button
        type="button"
        aria-label="Close upload panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
      />

      <aside className="absolute left-0 top-0 h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] w-full max-w-140 border-r border-white/10 bg-[#0d0e15] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold">Upload Files</h3>
              <p className="text-sm text-white/55">Queue up to {MAX_UPLOAD_QUEUE} files, edit titles, add metadata, then upload.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Close upload panel"
              aria-label="Close upload panel"
              className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="space-y-2">
              <label className="text-sm text-white/60" htmlFor="upload-panel-workspace-select">Workspace</label>
              <select
                id="upload-panel-workspace-select"
                value={uploadWorkspaceId}
                onChange={(event) => setUploadWorkspaceId(event.target.value)}
                className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
                disabled={uploading}
              >
                {workspaceOptions.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Instrumental toggle */}
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-white">Instrumental</p>
                <p className="text-xs text-white/45">No lyrics — hides the lyrics field</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={uploadInstrumental}
                disabled={uploading}
                onClick={() => setUploadInstrumental((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${uploadInstrumental ? "bg-primary-500" : "bg-white/15"}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${uploadInstrumental ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            <div className={`grid gap-3 transition-all duration-200 ${uploadInstrumental ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
              <div className="space-y-1">
                <label htmlFor="upload-panel-prompt" className="text-sm text-white/60">Optional prompt (global)</label>
                <textarea
                  id="upload-panel-prompt"
                  value={uploadPromptDraft}
                  onChange={(event) => setUploadPromptDraft(event.target.value)}
                  rows={3}
                  disabled={uploading}
                  placeholder="Style / mood / context"
                  className="w-full rounded-xl border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                />
              </div>
              {!uploadInstrumental && (
                <div className="space-y-1">
                  <label htmlFor="upload-panel-lyrics" className="text-sm text-white/60">Optional lyrics (global)</label>
                  <textarea
                    id="upload-panel-lyrics"
                    value={uploadLyricsDraft}
                    onChange={(event) => setUploadLyricsDraft(event.target.value)}
                    rows={3}
                    disabled={uploading}
                    placeholder="Paste lyrics"
                    className="w-full rounded-xl border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                accept=".mp3,.wav,audio/mpeg,audio/wav"
                aria-label="Queue MP3/WAV files"
                title="Queue MP3/WAV files"
                className="hidden"
                disabled={uploading}
                onChange={(event) => handleQueueAudioSelection(event.target.files)}
              />
              <input
                ref={uploadMetadataInputRef}
                type="file"
                accept=".txt,.lrc,text/plain"
                aria-label="Attach metadata TXT or LRC file"
                title="Attach metadata TXT or LRC file"
                className="hidden"
                disabled={uploading}
                onChange={(event) => handleMetadataAttachSelection(event.target.files)}
              />
              <input
                ref={uploadLicenseInputRef}
                type="file"
                accept=".pdf,application/pdf"
                aria-label="Attach license PDF"
                title="Attach license PDF"
                className="hidden"
                disabled={uploading}
                onChange={(event) => handleLicenseAttachSelection(event.target.files)}
              />

              <button
                type="button"
                disabled={uploading || queuedUploads.length >= MAX_UPLOAD_QUEUE}
                onClick={() => uploadInputRef.current?.click()}
                className="h-10 rounded-full border border-white/10 bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-65"
              >
                Add MP3/WAV Files
              </button>

              <span className="text-xs text-white/55">{queuedUploads.length}/{MAX_UPLOAD_QUEUE} queued</span>
            </div>

            <div
              onDrop={handleUploadDrop}
              onDragOver={handleUploadDragOver}
              onDragEnter={handleUploadDragOver}
              onDragLeave={handleUploadDragLeave}
              className={`rounded-2xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
                isUploadDropzoneActive
                  ? "border-primary-400/80 bg-primary-500/10"
                  : "border-white/15 bg-white/3"
              } ${uploading ? "opacity-60" : ""}`}
            >
              <p className="text-sm font-medium text-white/85">Drag and drop MP3/WAV files here</p>
              <p className="mt-1 text-xs text-white/55">Drop files to add them to the upload queue.</p>
            </div>

            {queuedUploads.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/12 bg-white/3 p-4 text-sm text-white/55">
                No files queued yet.
              </div>
            ) : (
              <div className="space-y-2">
                {queuedUploads.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/3 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{item.file.name}</p>
                        <p className="text-xs text-white/45">{formatFileSize(item.file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQueuedUploads((current) => current.filter((upload) => upload.id !== item.id))}
                        className="rounded-full p-1.5 text-white/45 transition-colors hover:bg-red-500/10 hover:text-red-300"
                        title="Remove from queue"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="mt-2 space-y-2">
                      <label htmlFor={`upload-item-title-${item.id}`} className="text-sm text-white/60">Title</label>
                      <input
                        id={`upload-item-title-${item.id}`}
                        type="text"
                        value={item.title}
                        onChange={(event) => {
                          const nextTitle = event.target.value;
                          setQueuedUploads((current) =>
                            current.map((upload) =>
                              upload.id === item.id ? { ...upload, title: nextTitle } : upload
                            )
                          );
                        }}
                        disabled={uploading}
                        className="h-9 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
                      />

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label htmlFor={`upload-item-artist-${item.id}`} className="text-sm text-white/60">Artist</label>
                          <AutocompleteInput
                            id={`upload-item-artist-${item.id}`}
                            value={item.artistName}
                            onChange={(v) => setQueuedUploads((current) =>
                              current.map((upload) => upload.id === item.id ? { ...upload, artistName: v } : upload)
                            )}
                            disabled={uploading}
                            placeholder="Artist name"
                            suggestions={knownArtistNames}
                            className="h-9 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor={`upload-item-composer-${item.id}`} className="text-sm text-white/60">Composer</label>
                          <AutocompleteInput
                            id={`upload-item-composer-${item.id}`}
                            value={item.composerName}
                            onChange={(v) => setQueuedUploads((current) =>
                              current.map((upload) => upload.id === item.id ? { ...upload, composerName: v } : upload)
                            )}
                            disabled={uploading}
                            placeholder="Composer name"
                            suggestions={knownComposerNames}
                            className="h-9 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor={`upload-item-writer-${item.id}`} className="text-sm text-white/60">Written By</label>
                          <AutocompleteInput
                            id={`upload-item-writer-${item.id}`}
                            value={item.writerName}
                            onChange={(v) => setQueuedUploads((current) =>
                              current.map((upload) => upload.id === item.id ? { ...upload, writerName: v } : upload)
                            )}
                            disabled={uploading}
                            placeholder="Lyrics writer"
                            suggestions={knownWriterNames}
                            className="h-9 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm text-white/60">Cover art</label>
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/8 flex items-center justify-center">
                            {item.coverFile ? (
                              <img loading="lazy" src={URL.createObjectURL(item.coverFile)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <label
                              htmlFor={`upload-item-cover-${item.id}`}
                              className="cursor-pointer rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
                            >
                              {item.coverFile ? "Change" : "Upload image"}
                            </label>
                            <input
                              id={`upload-item-cover-${item.id}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploading}
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                setQueuedUploads((current) =>
                                  current.map((upload) => upload.id === item.id ? { ...upload, coverFile: f } : upload)
                                );
                                e.target.value = "";
                              }}
                            />
                            {item.coverFile && (
                              <button
                                type="button"
                                onClick={() => setQueuedUploads((current) =>
                                  current.map((upload) => upload.id === item.id ? { ...upload, coverFile: null } : upload)
                                )}
                                className="rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor={`upload-item-provider-${item.id}`} className="text-sm text-white/50">Source</label>
                        <select
                          id={`upload-item-provider-${item.id}`}
                          value={UPLOAD_PROVIDERS.some((p) => p.value === item.sourceProvider) ? item.sourceProvider : "__custom__"}
                          onChange={(event) => {
                            const v = event.target.value;
                            setQueuedUploads((current) =>
                              current.map((upload) => upload.id === item.id ? { ...upload, sourceProvider: v === "__custom__" ? "" : v } : upload)
                            );
                          }}
                          disabled={uploading}
                          className="h-8 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
                        >
                          {UPLOAD_PROVIDERS.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                          {!UPLOAD_PROVIDERS.some((p) => p.value === item.sourceProvider) && item.sourceProvider && (
                            <option value="__custom__">{item.sourceProvider}</option>
                          )}
                        </select>
                      </div>

                      {item.sourceProvider === "suno" && (
                        <div className="space-y-3 rounded-xl border border-white/8 bg-white/3 px-3 py-3">
                          <SliderWithInput
                            label="Style Influence"
                            value={item.sunoStyleInfluence}
                            onChange={(v) => setQueuedUploads((current) =>
                              current.map((u) => u.id === item.id ? { ...u, sunoStyleInfluence: v } : u)
                            )}
                            disabled={uploading}
                          />
                          <SliderWithInput
                            label="Weirdness"
                            value={item.sunoWeirdness}
                            onChange={(v) => setQueuedUploads((current) =>
                              current.map((u) => u.id === item.id ? { ...u, sunoWeirdness: v } : u)
                            )}
                            disabled={uploading}
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <label className="text-sm text-white/50">Instrumental</label>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={item.instrumental}
                          disabled={uploading}
                          onClick={() => setQueuedUploads((current) =>
                            current.map((upload) =>
                              upload.id === item.id ? { ...upload, instrumental: !upload.instrumental } : upload
                            )
                          )}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${item.instrumental ? "bg-primary-500" : "bg-white/15"}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${item.instrumental ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                      </div>

                      <div className={`grid gap-2 ${item.instrumental ? "grid-cols-1" : "grid-cols-2"}`}>
                        <div className="space-y-1">
                          <label htmlFor={`upload-item-prompt-${item.id}`} className="text-sm text-white/50">Prompt</label>
                          <textarea
                            id={`upload-item-prompt-${item.id}`}
                            value={item.prompt}
                            onChange={(event) => {
                              const v = event.target.value;
                              setQueuedUploads((current) =>
                                current.map((upload) => upload.id === item.id ? { ...upload, prompt: v } : upload)
                              );
                            }}
                            rows={2}
                            disabled={uploading}
                            placeholder="Style / mood / context"
                            className="w-full rounded-xl border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white outline-none focus:border-white/25 resize-none"
                          />
                        </div>
                        {!item.instrumental && (
                          <div className="space-y-1">
                            <label htmlFor={`upload-item-lyrics-${item.id}`} className="text-sm text-white/50">Lyrics</label>
                            <textarea
                              id={`upload-item-lyrics-${item.id}`}
                              value={item.lyrics}
                              onChange={(event) => {
                                const v = event.target.value;
                                setQueuedUploads((current) =>
                                  current.map((upload) => upload.id === item.id ? { ...upload, lyrics: v } : upload)
                                );
                              }}
                              rows={2}
                              disabled={uploading}
                              placeholder="Paste lyrics"
                              className="w-full rounded-xl border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white outline-none focus:border-white/25 resize-none"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => {
                            setPendingMetadataTargetId(item.id);
                            uploadMetadataInputRef.current?.click();
                          }}
                          className="h-8 rounded-full border border-white/12 bg-[#11121a] px-3 text-sm font-medium text-white/80 transition-colors hover:border-white/25 hover:text-white"
                        >
                          {item.metadataFile ? "Replace metadata TXT/LRC" : "Attach metadata TXT/LRC"}
                        </button>
                        {item.metadataFile && (
                          <>
                            <span className="truncate text-xs text-white/55">{item.metadataFile.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setQueuedUploads((current) =>
                                  current.map((upload) =>
                                    upload.id === item.id ? { ...upload, metadataFile: null } : upload
                                  )
                                );
                              }}
                              className="text-sm text-red-300/85 hover:text-red-200"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => {
                            setPendingLicenseTargetId(item.id);
                            uploadLicenseInputRef.current?.click();
                          }}
                          className="h-8 rounded-full border border-white/12 bg-[#11121a] px-3 text-sm font-medium text-white/80 transition-colors hover:border-white/25 hover:text-white"
                        >
                          {item.licenseFile ? "Replace license PDF" : "Attach license PDF"}
                        </button>
                        {item.licenseFile && (
                          <>
                            <span className="truncate text-xs text-white/55">{item.licenseFile.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setQueuedUploads((current) =>
                                  current.map((upload) =>
                                    upload.id === item.id ? { ...upload, licenseFile: null } : upload
                                  )
                                );
                              }}
                              className="text-sm text-red-300/85 hover:text-red-200"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {uploadError && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
                <span className="font-semibold">Error:</span> {uploadError}
              </div>
            )}

            {uploadNotice && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-400">
                <span className="font-semibold">Success:</span> {uploadNotice}
              </div>
            )}

            {rejectedFiles.length > 0 && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-sm font-semibold text-amber-300">Rejected files</p>
                <ul className="mt-2 space-y-1 text-sm text-amber-200/80">
                  {rejectedFiles.map((file, idx) => (
                    <li key={idx}>
                      <span className="font-medium">{file.filename}</span>: {file.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 px-5 py-4">
            <button
              type="button"
              disabled={uploading || queuedUploads.length === 0}
              onClick={handleStartUpload}
              className="h-11 w-full rounded-xl bg-white text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-65"
            >
              {uploading ? "Uploading..." : `Upload ${queuedUploads.length} file(s)`}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
