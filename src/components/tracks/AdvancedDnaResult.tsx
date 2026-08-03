"use client";

interface AdvancedDnaResultProps {
  lyricsAnalysis: string | null;
  compositionAnalysis: string | null;
  tips: string[];
  onClose: () => void;
}

export default function AdvancedDnaResult({
  lyricsAnalysis,
  compositionAnalysis,
  tips,
  onClose,
}: AdvancedDnaResultProps) {
  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#181822] p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Advanced Track DNA</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {lyricsAnalysis && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">Lyrics Analysis</h3>
            <p className="text-sm text-white/80 leading-relaxed">{lyricsAnalysis}</p>
          </div>
        )}

        {compositionAnalysis && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">Composition &amp; Mix</h3>
            <p className="text-sm text-white/80 leading-relaxed">{compositionAnalysis}</p>
          </div>
        )}

        {tips.length > 0 && (
          <div className="space-y-2 border-t border-white/10 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-300">
              {tips.length} {tips.length === 1 ? "Tip" : "Tips"} for improvement
            </h3>
            <ol className="space-y-2 list-decimal list-inside">
              {tips.map((tip, i) => (
                <li key={i} className="text-sm text-white/80 leading-relaxed">
                  {tip}
                </li>
              ))}
            </ol>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-white/10 py-2 text-sm font-medium text-white hover:bg-white/15 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}