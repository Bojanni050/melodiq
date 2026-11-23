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

/** Radians per ms: ~0.3 rad/s, one full turn in about 20 seconds. */
const SPIN_SPEED = 0.0003;
/** Gap between a bead and the start of its label pill. */
const LABEL_OFFSET = 14;
/** Label column width left of the canvas edge. */
const LABEL_MAX_WIDTH = HELIX_WIDTH - HELIX_LABEL_X - 6;
const PILL_HEIGHT = 26;

// Illustration palette for the helix: glossy teal tubes, pale mint crossbars and
// glassy joints, following the reference artwork. Not UI chrome.
// ds-allow-hardcode:start
const HELIX_COLORS = {
  strandNear: "url(#dna-strand-near)",
  strandFar: "url(#dna-strand-far)",
  outlineNear: "#102e2b",
  outlineFar: "#183d39",
  sheen: "#eaf6ef",
  rungBody: "#a8c0b7",
  rungOutline: "#0d2b26",
  rungEdge: "#dce7df",
  beadRim: "#6eaa9b",
  beadSpecular: "#e1eee6",
  pillFill: "#08120f",
  pillStroke: "#26382f",
  pillText: "#dbe7e1",
  pillTextActive: "#f2fffa",
  pillValue: "#8ba59b",
} as const;
// ds-allow-hardcode:end

/**
 * The projected helix from lib/dna/helix.ts, drawn as SVG. Rotation is local
 * state so a drag or the spin toggle never touches the profile payload.
 *
 * The look follows the teal reference artwork: two glossy gradient tubes with a
 * dark under-stroke, pale mint crossbars and glassy spherical joints. Depth is
 * encoded in colour, size and opacity rather than filters — a Gaussian blur on
 * every segment would re-render on every spin frame — so the shape keeps its 3D
 * read while staying cheap on mobile. Painting order does the rest: far strand,
 * back half of the rungs, near strand, front half, beads.
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

  /**
   * One strand in three passes (dark under-stroke, gradient body, top sheen).
   * The passes are separate so a segment's wider under-stroke never cuts a notch
   * into the body of the segment painted just before it.
   */
  const drawStrand = (
    segments: typeof scene.segments,
    keyPrefix: string,
    body: string,
    outline: string,
    underOpacity: number,
    fade = 1
  ) => {
    const line = (
      segment: (typeof segments)[number],
      key: string,
      stroke: string,
      width: number,
      opacity = 1
    ) => (
      <line
        key={key}
        x1={segment.x1}
        y1={segment.y1}
        x2={segment.x2}
        y2={segment.y2}
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        opacity={opacity}
      />
    );
    const nearness = (depth: number) => (depth + 1) / 2;
    return (
      <g>
        {segments.map((segment, index) =>
          line(segment, `${keyPrefix}-o-${index}`, outline, strandWidth(segment.depth) + 5, underOpacity)
        )}
        {segments.map((segment, index) =>
          line(
            segment,
            `${keyPrefix}-b-${index}`,
            body,
            strandWidth(segment.depth),
            fade * (0.85 + 0.15 * nearness(segment.depth))
          )
        )}
        {segments.map((segment, index) =>
          line(
            segment,
            `${keyPrefix}-h-${index}`,
            HELIX_COLORS.sheen,
            Math.max(1, strandWidth(segment.depth) * 0.22),
            0.05 + 0.16 * nearness(segment.depth)
          )
        )}
      </g>
    );
  };

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
            <stop offset="0%" stopColor="#7fe0c3" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#20806a" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#20806a" stopOpacity="0" />
          </radialGradient>
          {/* A glassy joint: highlight up-left, deep teal shadow down-right. */}
          <radialGradient id="dna-bead" cx="0.32" cy="0.25" r="0.78">
            <stop offset="0%" stopColor="#b5d2c7" />
            <stop offset="22%" stopColor="#4e9b89" />
            <stop offset="62%" stopColor="#176c5e" />
            <stop offset="100%" stopColor="#073d37" />
          </radialGradient>
          {/*
           * The strands are short segments, so the gradient lives in user space
           * and runs down the whole helix: together the pieces read as one glossy
           * tube whose colour shifts with height, like the reference artwork.
           */}
          <linearGradient
            id="dna-strand-near"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="0"
            y2={scene.height}
          >
            <stop offset="0%" stopColor="#8fb8ab" />
            <stop offset="20%" stopColor="#4d9184" />
            <stop offset="45%" stopColor="#1c6a5d" />
            <stop offset="68%" stopColor="#7db3a4" />
            <stop offset="100%" stopColor="#2b655c" />
          </linearGradient>
          <linearGradient
            id="dna-strand-far"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="0"
            y2={scene.height}
          >
            <stop offset="0%" stopColor="#6f9a8e" />
            <stop offset="22%" stopColor="#2f6f64" />
            <stop offset="52%" stopColor="#124f46" />
            <stop offset="78%" stopColor="#5a8c80" />
            <stop offset="100%" stopColor="#1d574e" />
          </linearGradient>
        </defs>

        {/* Furthest first: back halves of the rungs sit behind the far strand. */}
        {scene.nodes.map((node) => (
          <g key={`back-${node.key}`}>
            <line
              x1={HELIX_CENTER_X}
              y1={node.y}
              x2={node.back.x}
              y2={node.back.y}
              stroke={HELIX_COLORS.rungOutline}
              strokeWidth={7.5}
              strokeLinecap="round"
              opacity={0.45}
            />
            <line
              x1={HELIX_CENTER_X}
              y1={node.y}
              x2={node.back.x}
              y2={node.back.y}
              stroke={HELIX_COLORS.rungBody}
              strokeWidth={4.5}
              strokeLinecap="round"
              opacity={0.55}
            />
          </g>
        ))}

        {drawStrand(farSegments, "far", HELIX_COLORS.strandFar, HELIX_COLORS.outlineFar, 0.5, 0.55)}

        {/* Front halves of the rungs: mint bars crossing to the visible strand. */}
        {scene.nodes.map((node) => {
          const near = (node.depth + 1) / 2;
          const width = 6 + 2.5 * near;
          return (
            <g key={`front-${node.key}`}>
              <line
                x1={HELIX_CENTER_X}
                y1={node.y}
                x2={node.x}
                y2={node.y}
                stroke={HELIX_COLORS.rungOutline}
                strokeWidth={width + 3}
                strokeLinecap="round"
                opacity={0.55}
              />
              <line
                x1={HELIX_CENTER_X}
                y1={node.y}
                x2={node.x}
                y2={node.y}
                stroke={HELIX_COLORS.rungBody}
                strokeWidth={width}
                strokeLinecap="round"
              />
              <line
                x1={HELIX_CENTER_X}
                y1={node.y - width * 0.2}
                x2={node.x}
                y2={node.y - width * 0.2}
                stroke={HELIX_COLORS.rungEdge}
                strokeWidth={1.6}
                strokeLinecap="round"
                opacity={0.2 + 0.24 * near}
              />
            </g>
          );
        })}

        {drawStrand(nearSegments, "near", HELIX_COLORS.strandNear, HELIX_COLORS.outlineNear, 0.6)}

        {/* Beads sit on the strand, so they go over both rungs and tube. */}
        {scene.nodes.map((node) => {
          const color = dnaCategoryColor(node.category);
          const near = (node.depth + 1) / 2;
          const isSelected = node.key === selectedKey;
          const frontRadius = nodeRadius(node.depth);
          const backRadius = nodeRadius(-node.depth);
          // The reference gets its gloss from a lit sphere plus one hard
          // specular dot; drawing that dot by hand beats a filter per bead.
          const specular = (x: number, y: number, radius: number) => (
            <>
              <circle cx={x} cy={y} r={radius} fill="url(#dna-bead)" />
              <circle
                cx={x - radius * 0.32}
                cy={y - radius * 0.36}
                r={Math.max(1, radius * 0.24)}
                fill={HELIX_COLORS.beadSpecular}
                opacity={0.45}
              />
            </>
          );
          return (
            <g key={`bead-${node.key}`}>
              <circle cx={node.back.x} cy={node.back.y} r={backRadius * 1.9} fill="url(#dna-bead-glow)" opacity={0.4} />
              <g>
                {specular(node.back.x, node.back.y, backRadius)}
                <circle
                  cx={node.back.x}
                  cy={node.back.y}
                  r={backRadius}
                  fill="none"
                  stroke={HELIX_COLORS.beadRim}
                  strokeWidth={1}
                  strokeOpacity={0.28}
                />
              </g>
              <circle cx={node.x} cy={node.y} r={frontRadius * 2} fill="url(#dna-bead-glow)" opacity={0.55 + 0.25 * near} />
              <g>
                {specular(node.x, node.y, frontRadius)}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={frontRadius}
                  fill="none"
                  stroke={isSelected ? color : HELIX_COLORS.beadRim}
                  strokeWidth={isSelected ? 2.2 : 1.1}
                  strokeOpacity={isSelected ? 1 : 0.4}
                />
              </g>
            </g>
          );
        })}

        {/* Labels last: pills over everything, hugging the bead they belong to. */}
        {scene.nodes.map((node) => {
          const color = dnaCategoryColor(node.category);
          const near = (node.depth + 1) / 2;
          const isSelected = node.key === selectedKey;
          const metrics = labelByKey.get(node.key);
          if (!metrics) return null;
          const startX =
            Math.max(node.x + nodeRadius(node.depth), node.back.x + nodeRadius(-node.depth)) + LABEL_OFFSET;
          return (
            <g
              key={`label-${node.key}`}
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
                x={startX}
                y={node.y - PILL_HEIGHT / 2}
                width={metrics.width}
                height={PILL_HEIGHT}
                rx={8}
                fill={HELIX_COLORS.pillFill}
                fillOpacity={isSelected ? 0.94 : 0.78}
                stroke={isSelected ? color : HELIX_COLORS.pillStroke}
                strokeWidth={isSelected ? 1.4 : 1}
                className="transition-colors focus-visible:stroke-[2]"
              />
              <circle cx={startX + 13} cy={node.y} r={3.4} fill={color} />
              <text
                x={startX + 23}
                y={node.y + 4}
                fontSize={11.5}
                fontWeight={600}
                fill={isSelected ? HELIX_COLORS.pillTextActive : HELIX_COLORS.pillText}
              >
                {metrics.label}
              </text>
              {metrics.display ? (
                <text
                  x={startX + 23 + metrics.label.length * 11.5 * 0.6 + 6}
                  y={node.y + 4}
                  fontSize={11}
                  fill={HELIX_COLORS.pillValue}
                >
                  {metrics.display}
                </text>
              ) : null}
            </g>
          );
        })}

        {selected ? (
          <circle
            cx={selected.x}
            cy={selected.y}
            r={nodeRadius(selected.depth) + 8}
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
