"use client";

import { useEffect } from "react";
import { useT } from "@/hooks/useT";

export default function NoticeBar({
  notice,
  onClose,
}: {
  notice: { type: "error" | "success"; message: string } | null;
  onClose: () => void;
}) {
  const t = useT();
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [notice, onClose]);

  if (!notice) return null;

  return (
    <div className="fixed left-1/2 top-4 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-950/80 px-4 py-3 shadow-2xl backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {notice.type === "error" ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          )}
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fuchsia-100">{notice.message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-fuchsia-200/70 hover:text-fuchsia-100"
          aria-label={t("studio.closeNotification")}
          title={t("playlists.close")}
        >
          x
        </button>
      </div>
    </div>
  );
}
