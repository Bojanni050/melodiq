"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  HELIX_LABEL_MAX_CHARS,
  HELIX_LABEL_X,
  buildHelixLayout,
  categoryGapIndices,
  nodeRadius,
  toPath,
  truncate,
  type HelixTraitInput,
} from "@/lib/dna/helix";
import { dnaCategoryColor } from "@/lib/dna/palette";import { useT } from "@/hooks/useT";

type Props = {
  traits: HelixTraitInput[];
  categoryLabels: Record<string, string>;
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
};

const SPIN_SPEED = 0.0045;

/**
 * The projected helix from lib/dna/helix.ts, drawn as SVG. Rotation is local
 * state so a drag or the spin toggle never touches the profile payload.
 */
export default function DnaHelix({ traits, categoryLabels, onSelect, selectedKey = null }: Props) {
  const t = useT();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const frame = useRef<number | null>(null);
  const dragging = useRef<{ x: number; rotation: number } | null>(null);

  // Traits arrive sorted by category; let the layout break between the groups.
  const gaps = useMemo(() => categoryGapIndices(traits), [traits]);
  const layout = useMemo(() => buildHelixLayout(traits, rotation, gaps), [traits, rotation, gaps]);
  const byKey = useMemo(() => new Map(layout.nodes.map((node) => [node.key, node])), [layout]);
  const selected = selectedKey ? byKey.get(selectedKey) : null;

  useEffect(() => {
    if (!spinning) return;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(64, now - last);
      last = now;
      setRotation((value) => value + SPIN_SPEED * delta);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [spinning]);

  // A slow spin is decoration; keep it off when the user asked for less motion.
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    setReducedMotion(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    dragging.current = { x: event.clientX, rotation };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSpinning(false);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const delta = event.clientX - dragging.current.x;
    setRotation(dragging.current.rotation + delta * 0.012);
  };

  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (traits.length === 0) {
    return <p className="px-4 py-8 text-sm text-ink-dim">{t("dna.helixEmpty")}</p>;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_32%_40%,rgba(111,212,165,0.10),transparent_60%)]" />

      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="relative w-full touch-pan-y select-none"
        role="img"
        aria-label={t("dna.helixTitle")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <path
          d={toPath(layout.leftStrand)}
          fill="none"
          stroke="#31544a"
          strokeWidth={9}
          strokeLinecap="round"
          opacity={0.55}
        />
        <path
          d={toPath(layout.rightStrand)}
          fill="none"
          stroke="#3d6a5c"
          strokeWidth={9}
          strokeLinecap="round"
          opacity={0.4}
        />

        {layout.nodes.map((node) => {
          const color = dnaCategoryColor(node.category);
          const front = (node.depth + 1) / 2;
          const isSelected = node.key === selectedKey;
          const labelX = HELIX_LABEL_X;
          return (
            <g key={node.key}>
              <line
                x1={node.rung.x1}
                y1={node.y}
                x2={node.rung.x2}
                y2={node.y}
                stroke={color}
                strokeWidth={1.4}
                opacity={0.16 + 0.4 * front}
              />
              <line
                x1={Math.max(node.rung.x1, node.rung.x2) + 8}
                y1={node.y}
                x2={labelX - 10}
                y2={node.y}
                stroke={color}
                strokeWidth={1}
                opacity={isSelected ? 0.7 : 0.18}
              />
              <circle
                cx={node.x}
                cy={node.y}
                r={nodeRadius(node.depth) + (isSelected ? 2 : 0)}
                fill={isSelected ? color : "#0a1210"}
                stroke={color}
                strokeWidth={isSelected ? 2.4 : 1.8}
                opacity={0.45 + 0.55 * front}
                role="button"
                tabIndex={0}
                aria-label={`${node.label}: ${node.display}`}
                aria-pressed={isSelected}
                className="cursor-pointer outline-none focus-visible:stroke-[3]"
                onClick={() => onSelect?.(node.key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect?.(node.key);
                  }
                }}
              />
              <text
                x={labelX}
                y={node.y - 3}
                textAnchor="end"
                fontSize={12}
                fill={isSelected ? "#e7eeea" : "#b6c6bf"}
                opacity={0.55 + 0.45 * front}
              >
                {truncate(node.label, HELIX_LABEL_MAX_CHARS)}
              </text>
              <text
                x={labelX}
                y={node.y + 12}
                textAnchor="end"
                fontSize={11.5}
                fill="#7f918a"
                opacity={0.6 + 0.4 * front}
              >
                {truncate(node.display, HELIX_LABEL_MAX_CHARS)}
              </text>
            </g>
          );
        })}

        {selected ? (
          <circle
            cx={selected.x}
            cy={selected.y}
            r={16}
            fill="none"
            stroke={dnaCategoryColor(selected.category)}
            strokeWidth={1}
            opacity={0.5}
          />
        ) : null}
      </svg>

      <div className="relative mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-ink-dim">{t("dna.helixHint")}</p>
        <div className="flex items-center gap-2">
          {!reducedMotion && (
            <button
              type="button"
              onClick={() => setSpinning((value) => !value)}
              aria-pressed={spinning}
              className={`inline-flex h-8 items-center rounded-full border px-3 text-xs transition-colors ${
                spinning
                  ? "border-accent/60 bg-accent/15 text-accent"
                  : "border-line bg-white/5 text-ink-muted hover:bg-white/10"
              }`}
            >
              {spinning ? t("dna.helixStop") : t("dna.helixSpin")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSpinning(false);
              setRotation(0);
            }}
            className="inline-flex h-8 items-center rounded-full border border-line bg-white/5 px-3 text-xs text-ink-muted transition-colors hover:bg-white/10"
          >
            {t("dna.helixReset")}
          </button>
        </div>
      </div>

      {selected ? (
        <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border border-line bg-canvas/60 px-3 py-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: dnaCategoryColor(selected.category) }}
          />
          <p className="text-xs text-ink-muted">
            {categoryLabels[selected.category] ?? selected.category}
          </p>
          <p className="text-sm font-medium">{selected.label}</p>
          <p className="text-sm text-ink-muted">{selected.display}</p>
          <p className="ml-auto text-[11px] tabular-nums text-ink-dim">
            {t("dna.confidenceShort", { value: Math.round(selected.confidence * 100) })}
          </p>
        </div>
      ) : null}
    </div>
  );
}

