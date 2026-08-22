"use client";

import { useState, useEffect } from "react";
import { usePresetsStore } from "@/lib/store";

export default function PresetsManager({
  songIdea,
  setSongIdea,
}: {
  songIdea: string;
  setSongIdea: (idea: string) => void;
}) {
  const presets = usePresetsStore((state) => state.presets);
  const presetsLoaded = usePresetsStore((state) => state.presetsLoaded);
  const fetchPresets = usePresetsStore((state) => state.fetchPresets);
  const addPreset = usePresetsStore((state) => state.addPreset);
  const deletePreset = usePresetsStore((state) => state.deletePreset);

  useEffect(() => {
    if (!presetsLoaded) {
      void fetchPresets();
    }
  }, [presetsLoaded, fetchPresets]);

  const [showSavePresetForm, setShowSavePresetForm] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetNotes, setPresetNotes] = useState("");
  const [showSavedPresetsList, setShowSavedPresetsList] = useState(false);
  const [loadedPresetId, setLoadedPresetId] = useState<string | null>(null);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!songIdea.trim()}
          onClick={() => {
            setShowSavePresetForm(!showSavePresetForm);
            setPresetName("");
            setPresetNotes("");
          }}
          className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Sla huidige stijl op als preset"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Save Preset
        </button>

        {presets.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSavedPresetsList(!showSavedPresetsList)}
            className={`btn-ghost text-sm flex items-center gap-1.5 ${
              showSavedPresetsList ? "text-primary-300 font-semibold" : "text-white/60 hover:text-white"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            My Presets ({presets.length})
          </button>
        )}
      </div>

      {/* Save Preset Form */}
      {showSavePresetForm && (
        <div className="mt-4 p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
          <p className="text-sm font-semibold text-primary-300">Save Style & Prompt Preset</p>
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] text-white/50 mb-1">Preset Name</label>
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g. Dutch Melancholy, Summer Uplifting"
                className="input-field text-sm py-1.5 focus:border-primary-500/50 outline-none"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-[10px] text-white/50 mb-1">Notes about this prompt</label>
              <textarea
                value={presetNotes}
                onChange={(e) => setPresetNotes(e.target.value)}
                placeholder="Notes down specific ideas, instruments, or details..."
                className="input-field text-sm py-1.5 min-h-[60px] resize-y focus:border-primary-500/50 outline-none"
                maxLength={500}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowSavePresetForm(false)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!presetName.trim()}
              onClick={async () => {
                const result = await addPreset(presetName, songIdea, presetNotes);
                if (result) {
                  setShowSavePresetForm(false);
                  setShowSavedPresetsList(true);
                  setPresetName("");
                  setPresetNotes("");
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-primary-500/80 hover:bg-primary-500 text-sm text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* My Presets List */}
      {showSavedPresetsList && presets.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white/60">My Saved Presets</p>
            <button
              type="button"
              onClick={() => setShowSavedPresetsList(false)}
              className="text-[10px] text-white/40 hover:text-white/60"
            >
              Close list
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {presets.map((preset) => {
              const isLoaded = loadedPresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  className="flex flex-col gap-1.5 p-3 rounded-lg border border-white/6 bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white/95 truncate">{preset.name}</p>
                      <p className="text-[10px] text-white/30 truncate mt-0.5" title={preset.prompt}>
                        Prompt: {preset.prompt}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSongIdea(preset.prompt);
                          setLoadedPresetId(preset.id);
                          setTimeout(() => setLoadedPresetId(null), 1500);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                          isLoaded
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                        }`}
                      >
                        {isLoaded ? "Loaded ✓" : "Load"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deletePreset(preset.id)}
                        className="p-1 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors"
                        title="Delete Preset"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {preset.notes && (
                    <div className="text-[10px] text-white/50 border-l border-primary-500/20 pl-2 py-0.5 bg-primary-500/[0.02] rounded-r">
                      <span className="font-semibold text-white/70">Notes: </span>
                      {preset.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
