"use client";

import type { ArchiveBlockReason } from "@/lib/track-archive-guards";

export default function ArchiveBlockedDialog({
  reasons,
  onClose,
}: {
  reasons: ArchiveBlockReason[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-6 w-80 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-white/80 leading-relaxed">This track can't be archived yet:</p>
            <ul className="text-sm text-white/60 leading-relaxed list-disc list-inside space-y-1">
              {reasons.map((reason, i) => (
                <li key={i}>{reason.detail}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
