"use client";

import WaveformBars from "@/components/tracks/WaveformBars";

export default function GeneratingRow() {
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary-600/5 border border-primary-600/20 animate-[pulse_3s_ease-in-out_infinite]">
      {/* Empty selection dot — generating tracks can't be selected */}
      <div className="w-5 h-5 shrink-0" />

      {/* Waveform in play button area */}
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-primary-600/20 text-primary-400">
        <WaveformBars count={5} className="h-3.5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium truncate">Composing your track</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-300 animate-[pulse_2s_ease-in-out_infinite]">
            Creating
          </span>
        </div>
        {/* Full-width waveform in description row */}
        <div className="mt-1.5 text-primary-500/40 w-full">
          <WaveformBars count={32} className="h-2.5 w-full" />
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-white/20 mr-1">now</span>
      </div>
    </div>
  );
}
