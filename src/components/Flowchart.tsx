import React from "react";

export interface FlowchartProps {
  blocks: Array<{ label: string; type: string }>;
}

// Simple mapping for block type to flowchart symbol
function getSymbol(type: string) {
  switch (type) {
    case "intro":
      return "( )";
    case "verse":
      return "[ ]";
    case "pre-chorus":
      return "< >";
    case "chorus":
      return "{ }";
    case "post-chorus":
      return "<=>";
    case "bridge":
      return "[::]";
    case "outro":
      return "( )";
    default:
      return "[?]";
  }
}

// Render a simple ASCII/mermaid-like flowchart
export default function Flowchart({ blocks }: FlowchartProps) {
  if (!blocks.length) return null;

  // Build a simple flow string
  const flow = blocks
    .map((block, idx) => {
      const symbol = getSymbol(block.type);
      return `${symbol} ${block.label}`;
    })
    .join("  →  ");

  return (
    <div className="p-3 bg-[#0f0f16] rounded-lg border border-white/10">
      <div className="mb-3 text-xs text-white/40 font-semibold uppercase tracking-wider">Flowchart</div>
      <div className="overflow-x-auto text-xs font-mono whitespace-normal text-primary-400 leading-relaxed break-words">
        {flow}
      </div>
      <div className="mt-3 text-[10px] text-white/25 space-y-1">
        <div>( ) Intro/Outro</div>
        <div>[ ] Verse</div>
        <div>{'< >'} Pre-Chorus</div>
        <div>{'{ }'} Chorus</div>
        <div>{'<=>'} Post-Chorus</div>
        <div>[::] Bridge</div>
      </div>
    </div>
  );
}
