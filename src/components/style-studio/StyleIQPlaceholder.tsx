"use client";

export default function StyleIQPlaceholder() {
  return (
    <section className="rounded-2xl border border-dashed border-white/15 bg-[#101018]/60 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-base">🎧</span>
        <h3 className="text-sm font-semibold text-white/85">StyleIQ™</h3>
      </div>
      <p className="text-xs text-white/40">Coming Soon</p>
      <p className="text-xs text-white/35 leading-relaxed">
        StyleIQ will generate, improve and refine musical styles based on your lyrics and creative
        intent.
      </p>
    </section>
  );
}
