// Share card for Melody DNA: a self-contained SVG the browser can rasterise to
// PNG without a server round-trip. Kept pure so the text layout can be tested
// and so the card can never diverge from the traits on screen.

import type { HelixTraitInput } from "./helix";
import { dnaCategoryColor } from "./palette";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
export const CARD_MAX_TRAITS = 8;
const CARD_SOLID_CONFIDENCE = 0.45;

export type DnaCardInput = {
  name: string;
  summary: string;
  statsLine: string;
  stageLabel: string;
  traits: HelixTraitInput[];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Wraps on word boundaries and ellipsises when the text does not fit. */
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  if (maxChars <= 0 || maxLines <= 0) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word.length > maxChars ? word.slice(0, maxChars) : word;
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] =
    last.length >= maxChars ? `${last.slice(0, maxChars - 1).trimEnd()}…` : `${last}…`;
  return kept;
}

/**
 * Picks the traits worth showing: solid ones first (they are what the user can
 * trust), then the best of the rest, capped so the card never crowds.
 */
export function selectCardTraits(traits: HelixTraitInput[], max = CARD_MAX_TRAITS): HelixTraitInput[] {
  const usable = traits.filter((trait) => trait.verdict !== "disputed" && trait.display.trim().length > 0);
  const solid = usable.filter((trait) => trait.confidence >= CARD_SOLID_CONFIDENCE);
  const soft = usable.filter((trait) => trait.confidence < CARD_SOLID_CONFIDENCE);
  return [...solid, ...soft].slice(0, max);
}

export function buildDnaCardSvg(input: DnaCardInput): string {
  const nameLines = wrapText(input.name || "Melody DNA", 20, 2);
  const summaryLines = wrapText(input.summary, 58, 3);
  const traits = selectCardTraits(input.traits);

  const nameMarkup = nameLines
    .map(
      (line, index) =>
        `<text x="80" y="${196 + index * 62}" font-size="54" font-weight="600" fill="#f4f7f5">${escapeXml(line)}</text>`
    )
    .join("");

  const nameBlockHeight = Math.max(nameLines.length, 1) * 62;
  const summaryTop = 196 + nameBlockHeight + 12;

  const summaryMarkup = summaryLines
    .map(
      (line, index) =>
        `<text x="80" y="${summaryTop + index * 30}" font-size="21" fill="#9db0a8">${escapeXml(line)}</text>`
    )
    .join("");

  const traitMarkup = traits
    .map((trait, index) => {
      const color = dnaCategoryColor(trait.category);
      const y = 128 + index * 54;
      return [
        `<circle cx="762" cy="${y - 5}" r="5" fill="${color}" />`,
        `<text x="782" y="${y}" font-size="19" fill="#e7eeea">${escapeXml(trait.label)}</text>`,
        `<text x="782" y="${y + 24}" font-size="17" fill="#8d9f97">${escapeXml(trait.display)}</text>`,
      ].join("");
    })
    .join("");

  // A quiet helix motif behind the trait list: enough to read as DNA without
  // competing with the text.
  const rungs: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const y = 96 + index * 46;
    const phase = index * 0.62 + 0.4;
    const x1 = 690 + 26 * Math.sin(phase);
    const x2 = 690 + 26 * Math.sin(phase + Math.PI);
    rungs.push(
      `<line x1="${x1.toFixed(1)}" y1="${y}" x2="${x2.toFixed(1)}" y2="${y}" stroke="#31544a" stroke-width="2" />` +
        `<circle cx="${Math.max(x1, x2).toFixed(1)}" cy="${y}" r="3.4" fill="#4c7a6b" />`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="#080d0b" />
  <rect x="0" y="0" width="6" height="${CARD_HEIGHT}" fill="#6fd4a5" />
  <circle cx="1060" cy="60" r="230" fill="#12302433" />
  <text x="80" y="86" font-size="15" letter-spacing="5" fill="#6fd4a5">MELODY DNA</text>
  <text x="80" y="120" font-size="16" fill="#7f918a">${escapeXml(input.stageLabel)}</text>
  ${nameMarkup}
  ${summaryMarkup}
  <line x1="80" y1="540" x2="1120" y2="540" stroke="#1d2b25" stroke-width="1" />
  <text x="80" y="580" font-size="18" fill="#9db0a8">${escapeXml(input.statsLine)}</text>
  <text x="1120" y="580" font-size="17" text-anchor="end" fill="#5f736b">melodIQ</text>
  ${rungs.join("")}
  ${traitMarkup}
</svg>`;
}
