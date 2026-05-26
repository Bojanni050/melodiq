"use client";

const WAVE_DELAYS = ["[animation-delay:0ms]", "[animation-delay:55ms]", "[animation-delay:110ms]", "[animation-delay:165ms]", "[animation-delay:220ms]"];
const WAVE_DURATIONS = ["[animation-duration:700ms]", "[animation-duration:790ms]", "[animation-duration:880ms]", "[animation-duration:970ms]", "[animation-duration:1060ms]"];

export default function WaveformBars({ count = 5, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-0.5 overflow-hidden ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`h-full w-0.5 animate-wave-bar bg-current rounded-[1px] shrink-0 ${i % 3 === 0 ? "opacity-100" : i % 3 === 1 ? "opacity-80" : "opacity-60"} ${WAVE_DELAYS[i % WAVE_DELAYS.length]} ${WAVE_DURATIONS[i % WAVE_DURATIONS.length]}`}
        />
      ))}
    </div>
  );
}
