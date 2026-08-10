"use client";

import { createPortal } from "react-dom";

interface ConfirmModalProps {
  icon: React.ReactNode;
  iconBgClassName: string;
  iconSizeClassName?: string;
  message: React.ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  confirmClassName: string;
  onCancel: () => void;
  onConfirm: () => void;
  widthClassName?: string;
}

/** Shared "are you sure" dialog shell — icon + message + cancel/confirm — used
 * by StudioForm's several confirmation prompts (clear all, vocal gender,
 * empty lyrics, style too long) so each only supplies its copy and colors. */
export default function ConfirmModal({
  icon,
  iconBgClassName,
  iconSizeClassName = "w-8 h-8",
  message,
  cancelLabel,
  confirmLabel,
  confirmClassName,
  onCancel,
  onConfirm,
  widthClassName = "w-96",
}: ConfirmModalProps) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onCancel} />
      <div className={`relative bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-6 ${widthClassName} flex flex-col gap-4`}>
        <div className="flex items-start gap-3">
          <div className={`${iconSizeClassName} rounded-full flex items-center justify-center shrink-0 mt-0.5 ${iconBgClassName}`}>
            {icon}
          </div>
          <div className="text-sm text-white/80 leading-relaxed">{message}</div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-1.5 text-sm text-white/60 hover:text-white/85 hover:bg-white/5 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg border px-4 py-1.5 text-sm transition-colors ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
