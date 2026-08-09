"use client";

interface SliderWithInputProps {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}

export default function SliderWithInput({
  label,
  value,
  onChange,
  disabled,
}: SliderWithInputProps) {
  const display = value ?? 50;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-white/60">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={100}
            value={value ?? ""}
            placeholder="—"
            disabled={disabled}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (e.target.value === "") { onChange(50); return; }
              if (!isNaN(n)) onChange(Math.min(100, Math.max(1, n)));
            }}
            className="w-12 rounded-lg border border-white/12 bg-[#11121a] px-2 py-0.5 text-center text-xs text-white outline-none focus:border-white/25 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-xs text-white/40">%</span>
        </div>
      </div>
      <input
        type="range"
        min={1}
        max={100}
        value={display}
        disabled={disabled}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-white/10 accent-primary-500 disabled:opacity-50"
      />
    </div>
  );
}
