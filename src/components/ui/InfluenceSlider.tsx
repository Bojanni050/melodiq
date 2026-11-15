"use client";

interface InfluenceSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Caption under the left end of the track, e.g. "Freer". */
  leftLabel: string;
  /** Caption under the right end of the track, e.g. "Exactly their sound". */
  rightLabel: string;
  id?: string;
  disabled?: boolean;
}

/**
 * Percentage slider with a caption at both ends. Used by the upload panel (and
 * track editor) to record a provider's "style influence" setting — the ends
 * carry the meaning there, so the value alone is not enough.
 */
export default function InfluenceSlider({
  label,
  value,
  onChange,
  leftLabel,
  rightLabel,
  id,
  disabled,
}: InfluenceSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs text-ink-muted">{label}</label>
        <span className="font-mono text-xs text-ink-dim">{value}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={100}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Math.min(100, Math.max(1, parseInt(event.target.value, 10))))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-emerald-400 disabled:opacity-50"
      />
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-ink-dim">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
