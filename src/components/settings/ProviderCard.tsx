"use client";

import { ReactNode } from "react";

export default function ProviderCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="section-card">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-white/30">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
