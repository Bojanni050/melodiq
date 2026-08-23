"use client";

import { useT } from "@/hooks/useT";
import type { StyleConfirmAction } from "@/lib/style-studio-types";

export default function StyleConfirmModal({
  confirmAction,
  onConfirm,
  onCancel,
}: {
  confirmAction: StyleConfirmAction;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  if (!confirmAction) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-[#2b1f10] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-amber-100">
              {confirmAction === "clearAll" && t("melody.clearAllStyleConfirm")}
              {confirmAction === "replaceStyle" && t("melody.replaceStyleConfirm")}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-200 transition-colors hover:bg-amber-500/20"
              >
                {t("common.confirm")}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white/85 hover:bg-white/5 transition-colors"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
