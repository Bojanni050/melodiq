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
    <div className="mt-8 p-4 bg-[#181820] rounded-xl border border-white/10">
      <div className="mb-2 text-xs text-white/40 font-semibold uppercase tracking-wider">Song Flowchart</div>
      <div className="overflow-x-auto text-sm font-mono whitespace-nowrap text-primary-400">
        {flow}
      </div>
      <div className="mt-2 text-xs text-white/30">Legenda: ( ) Intro/Outro, [ ] Verse, < > Pre-Chorus, { } Chorus, <=> Post-Chorus, [::] Bridge</div>
    </div>
  );
}
