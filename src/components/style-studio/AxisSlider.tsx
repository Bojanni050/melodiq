"use client";

export default function AxisSlider({
  left,
  right,
  value,
  onChange,
}: {
  left: string;
  right: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">{left}</span>
        <span className="text-[10px] text-white/40 uppercase tracking-wider">{right}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-white/10 accent-primary-500"
        style={{
          background: `linear-gradient(to right, #8b5cf6 ${value}%, rgba(255,255,255,0.1) ${value}%)`,
        }}
      />
    </div>
  );
}
