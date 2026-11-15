"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  HELIX_CENTER_X,
  HELIX_LABEL_X,
  HELIX_WIDTH,
  buildHelixScene,
  categoryGapIndices,
  fitHelixLabel,
  nodeRadius,
  strandWidth,
  type HelixTraitInput,
} from "@/lib/dna/helix";
import { dnaCategoryColor } from "@/lib/dna/palette";
import { useT } from "@/hooks/useT";

type Props = {
  traits: HelixTraitInput[];
  categoryLabels: Record<string, string>;
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
};

const SPIN_SPEED = 0.0045;
/** Label column width left of the canvas edge. */
const LABEL_MAX_WIDTH = HELIX_WIDTH - HELIX_LABEL_X - 6;
const PILL_HEIGHT = 26;

/**
 * The projected helix from lib/dna/helix.ts, drawn as SVG. Rotation is local
 * state so a drag or the spin toggle never touches the profile payload.
 *
 * The look is a translucent ribbon rather than a line drawing: each strand is a
 * soft halo under a pale body, rungs are light bars with a glowing bead at both
 * ends, and labels are dark pills with a dotted leader. Painting order does the
 * 3D work — far strand, back half of the rungs, near strand, front half, beads.
 */
export default function DnaHelix({ traits, categoryLabels, onSelect, selectedKey = null }: Props) {
  const t = useT();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const frame = useRef<number | null>(null);
  const dragging = useRef<{ x: number; rotation: number } | null>(null);

  // Traits arrive sorted by category; let the layout break between the groups.
  const gaps = useMemo(() => categoryGapIndices(traits), [traits]);
  const scene = useMemo(() => buildHelixScene(traits, rotation, gaps), [traits, rotation, gaps]);
  const byKey = useMemo(() => new Map(scene.nodes.map((node) => [node.key, node])), [scene]);
  const selected = selectedKey ? byKey.get(selectedKey) : null;

  const labels = useMemo(
    () =>
      scene.nodes.map((node) => ({
        key: node.key,
        ...fitHelixLabel(node.label, node.display, LABEL_MAX_WIDTH),
      })),
    [scene]
  );
  const labelByKey = useMemo(() => new Map(labels.map((label) => [label.key, label])), [labels]);

  const farSegments = useMemo(() => scene.segments.filter((segment) => segment.depth < 0), [scene]);
  const nearSegments = useMemo(() => scene.segments.filter((segment) => segment.depth >= 0), [scene]);

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

  const drawStrand = (segments: typeof scene.segments, keyPrefix: string) =>
    segments.map((segment, index) => {
      const near = (segment.depth + 1) / 2;
      const width = strandWidth(segment.depth);
      return (
        <g key={`${keyPrefix}-${index}`}>
          {/* Halo: the glow spilling out of the ribbon. */}
          <line
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke="#5ec9a4"
            strokeWidth={width * 3.2}
            strokeLinecap="round"
            opacity={0.06 + 0.12 * near}
          />
          {/* Body: near-white, barely opaque, so the rungs read through it. */}
          <line
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke="#d7f2e6"
            strokeWidth={width}
            strokeLinecap="round"
            opacity={0.12 + 0.3 * near}
          />
          {/* Edge highlight along the ribbon. */}
          <line
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke="#f2fffa"
            strokeWidth={Math.max(1.4, width * 0.22)}
            strokeLinecap="round"
            opacity={near > 0.5 ? 0.3 : 0.12}
          />
        </g>
      );
    });

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_45%,rgba(94,201,164,0.13),transparent_62%)]" />

      <svg
        viewBox={`0 0 ${scene.width} ${scene.height}`}
        className="relative mx-auto block w-full max-w-[700px] touch-pan-y select-none"
        role="img"
        aria-label={t("dna.helixTitle")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <defs>
          <radialGradient id="dna-bead-glow">
            <stop offset="0%" stopColor="#bdf5e2" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#54c8a2" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#54c8a2" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Furthest first: back halves of the rungs sit behind the far strand. */}
        {scene.nodes.map((node) => (
          <line
            key={`back-${node.key}`}
            x1={HELIX_CENTER_X}
            y1={node.y}
            x2={node.back.x}
            y2={node.back.y}
            stroke="#a9c3b7"
            strokeWidth={2.4}
            strokeLinecap="round"
            opacity={0.26}
          />
        ))}

        {drawStrand(farSegments, "far")}

        {/* Front halves of the rungs: pale bars crossing to the visible strand. */}
        {scene.nodes.map((node) => {
          const near = (node.depth + 1) / 2;
          return (
            <line
              key={`front-${node.key}`}
              x1={HELIX_CENTER_X}
              y1={node.y}
              x2={node.x}
              y2={node.y}
              stroke="#e6f2ec"
              strokeWidth={2.8 + 1.6 * near}
              strokeLinecap="round"
              opacity={0.32 + 0.4 * near}
            />
          );
        })}

        {drawStrand(nearSegments, "near")}

        {/* Beads sit on the strand, so they go over both rungs and ribbon. */}
        {scene.nodes.map((node) => {
          const color = dnaCategoryColor(node.category);
          const near = (node.depth + 1) / 2;
          return (
            <g key={`bead-${node.key}`}>
              <circle cx={node.back.x} cy={node.back.y} r={6 + 3 * (1 - near)} fill="url(#dna-bead-glow)" opacity={0.5} />
              <circle cx={node.back.x} cy={node.back.y} r={2.8} fill="#2b7f6c" stroke="#8fd9c2" strokeWidth={0.8} opacity={0.5} />
              <circle cx={node.x} cy={node.y} r={10 + 8 * near} fill="url(#dna-bead-glow)" opacity={0.7} />
              <circle
                cx={node.x}
                cy={node.y}
                r={nodeRadius(node.depth) + 1.5}
                fill="#2b8d78"
                stroke={node.key === selectedKey ? color : "#b7ecd9"}
                strokeWidth={node.key === selectedKey ? 2.2 : 1.1}
                opacity={0.75 + 0.25 * near}
              />
            </g>
          );
        })}

        {/* Labels last: pills over everything, with a dotted leader to the node. */}
        {scene.nodes.map((node) => {
          const color = dnaCategoryColor(node.category);
          const near = (node.depth + 1) / 2;
          const isSelected = node.key === selectedKey;
          const metrics = labelByKey.get(node.key);
          if (!metrics) return null;
          const startX = Math.max(node.x, node.back.x) + 9;
          return (
            <g key={`label-${node.key}`}>
              <line
                x1={startX}
                y1={node.y}
                x2={HELIX_LABEL_X - 6}
                y2={node.y}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="1.5 4"
                strokeLinecap="round"
                opacity={isSelected ? 0.7 : 0.25}
              />
              <g
                role="button"
                tabIndex={0}
                aria-label={`${node.label}: ${node.display}`}
                aria-pressed={isSelected}
                className="cursor-pointer outline-none"
                opacity={0.62 + 0.38 * near}
                onClick={() => onSelect?.(node.key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect?.(node.key);
                  }
                }}
              >
                <rect
                  x={HELIX_LABEL_X}
                  y={node.y - PILL_HEIGHT / 2}
                  width={metrics.width}
                  height={PILL_HEIGHT}
                  rx={8}
                  fill="#08120f"
                  fillOpacity={isSelected ? 0.94 : 0.78}
                  stroke={isSelected ? color : "#26382f"}
                  strokeWidth={isSelected ? 1.4 : 1}
                  className="transition-colors focus-visible:stroke-[2]"
                />
                <circle cx={HELIX_LABEL_X + 13} cy={node.y} r={3.4} fill={color} />
                <text
                  x={HELIX_LABEL_X + 23}
                  y={node.y + 4}
                  fontSize={11.5}
                  fontWeight={600}
                  fill={isSelected ? "#f2fffa" : "#dbe7e1"}
                >
                  {metrics.label}
                </text>
                {metrics.display ? (
                  <text
                    x={HELIX_LABEL_X + 23 + metrics.label.length * 11.5 * 0.6 + 6}
                    y={node.y + 4}
                    fontSize={11}
                    fill="#8ba59b"
                  >
                    {metrics.display}
                  </text>
                ) : null}
              </g>
            </g>
          );
        })}

        {selected ? (
          <circle
            cx={selected.x}
            cy={selected.y}
            r={18}
            fill="none"
            stroke={dnaCategoryColor(selected.category)}
            strokeWidth={1}
            opacity={0.45}
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
