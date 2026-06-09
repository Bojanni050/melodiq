"use client";

import { useRef } from "react";

export default function ResizablePanel({
  show,
  width,
  setWidth,
  children,
}: {
  show: boolean;
  width: number;
  setWidth: (value: number) => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);
  const currentWidthRef = useRef(width);

  function startResize(e: React.MouseEvent<HTMLDivElement>) {
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = width;
    currentWidthRef.current = width;

    const onMouseMove = (event: MouseEvent) => {
      const delta = resizeStartXRef.current - event.clientX;
      const next = Math.max(280, Math.min(800, resizeStartWidthRef.current + delta));
      currentWidthRef.current = next;
      // Write directly to the DOM — zero React re-renders while dragging
      if (panelRef.current) {
        panelRef.current.style.width = `${next}px`;
      }
    };

    const onMouseUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      // Single store update when drag ends
      setWidth(currentWidthRef.current);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  if (!show) return null;

  return (
    <>
      <div
        className="hidden lg:block w-1 cursor-col-resize bg-transparent hover:bg-white/10 transition-colors"
        onMouseDown={startResize}
        title="Resize details panel"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize details panel"
      />
      <aside
        ref={panelRef}
        style={{ width }}
        className="hidden lg:flex lg:flex-col shrink-0 border-l border-white/5 bg-[#0d0d12]"
      >
        {children}
      </aside>
    </>
  );
}
