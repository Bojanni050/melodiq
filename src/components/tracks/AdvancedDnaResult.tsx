"use client";

interface AdvancedDnaResultProps {
  summary: string | null;
  lyricsAnalysis: string | null;
  compositionAnalysis: string | null;
  tips: string[];
  compositionScore?: number | null;
  vocalScore?: number | null;
  productionScore?: number | null;
  overallScore?: number | null;
  onClose: () => void;
}

export default function AdvancedDnaResult({
  summary,
  lyricsAnalysis,
  compositionAnalysis,
  tips,
  compositionScore,
  vocalScore,
  productionScore,
  overallScore,
  onClose,
}: AdvancedDnaResultProps) {
  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto  border border-line bg-surface p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Advanced Track DNA</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-ink-dim hover:text-ink-muted hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {summary && (
          <p className="text-sm text-ink-muted leading-relaxed border-b border-line pb-4">{summary}</p>
        )}

        {overallScore != null && (
          <div className="flex items-center justify-between rounded border border-accent/30 bg-accent/10 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">Overall score</span>
            <span className="text-sm font-semibold text-accent">{overallScore.toFixed(1)}/10</span>
          </div>
        )}

        {(compositionScore != null || vocalScore != null || productionScore != null) && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {compositionScore != null && (
              <div className="space-y-0.5 rounded border border-line bg-white/[0.04] px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-ink-dim">Composition score</div>
                <div className="text-sm font-medium text-ink">{compositionScore.toFixed(1)}/10</div>
              </div>
            )}
            {vocalScore != null && (
              <div className="space-y-0.5 rounded border border-line bg-white/[0.04] px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-ink-dim">Vocal score</div>
                <div className="text-sm font-medium text-ink">{vocalScore.toFixed(1)}/10</div>
              </div>
            )}
            {productionScore != null && (
              <div className="space-y-0.5 rounded border border-line bg-white/[0.04] px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-ink-dim">Production score</div>
                <div className="text-sm font-medium text-ink">{productionScore.toFixed(1)}/10</div>
              </div>
            )}
          </div>
        )}

        {lyricsAnalysis && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-dim">Lyrics Analysis</h3>
            <p className="text-sm text-ink-muted leading-relaxed">{lyricsAnalysis}</p>
          </div>
        )}

        {compositionAnalysis && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-dim">Composition &amp; Mix</h3>
            <p className="text-sm text-ink-muted leading-relaxed">{compositionAnalysis}</p>
          </div>
        )}

        {tips.length > 0 && (
          <div className="space-y-2 border-t border-line pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">
              {tips.length} {tips.length === 1 ? "Tip" : "Tips"} for improvement
            </h3>
            <ol className="space-y-2 list-decimal list-inside">
              {tips.map((tip, i) => (
                <li key={i} className="text-sm text-ink-muted leading-relaxed">
                  {tip}
                </li>
              ))}
            </ol>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full  bg-white/10 py-2 text-sm font-medium text-ink hover:bg-white/15 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}