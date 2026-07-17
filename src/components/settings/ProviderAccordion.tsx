"use client";

import { ReactNode, useState } from "react";
import StatusBadge, { ProviderStatus } from "@/components/settings/StatusBadge";

export default function ProviderAccordion({
  title,
  description,
  status,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  status?: ProviderStatus;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="section-card !p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{title}</p>
          <p className="text-xs text-white/30 truncate">{description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status && <StatusBadge status={status} />}
          <svg
            className={`w-4 h-4 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-white/5">{children}</div>}
    </section>
  );
}
