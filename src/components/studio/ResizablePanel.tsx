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
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);

  function startResize(e: React.MouseEvent<HTMLDivElement>) {
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = width;

    const onMouseMove = (event: MouseEvent) => {
      const delta = resizeStartXRef.current - event.clientX;
      setWidth(resizeStartWidthRef.current + delta);
    };

    const onMouseUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
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
      <aside className="right-details-panel hidden lg:block shrink-0 border-l border-white/5 bg-[#0d0d12]">
        {children}
      </aside>
    </>
  );
}
