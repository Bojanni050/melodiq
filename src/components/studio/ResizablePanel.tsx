"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/hooks/useT";

const ANIMATION_MS = 300;

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
  const t = useT();
  const panelRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);
  const currentWidthRef = useRef(width);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `mounted` delays the unmount so the slide-out can play;
  // `open` drives the transition after mount (double rAF).
  const [mounted, setMounted] = useState(show);
  const [open, setOpen] = useState(show);

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
      if (contentRef.current) {
        contentRef.current.style.width = `${next}px`;
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

  useEffect(() => {
    if (show) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setMounted(true);
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setOpen(true))
      );
      return () => cancelAnimationFrame(raf);
    }
    setOpen(false);
    closeTimerRef.current = setTimeout(() => {
      setMounted(false);
      closeTimerRef.current = null;
    }, ANIMATION_MS);
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [show]);

  // Keep the live DOM widths in sync when the stored width changes
  // (e.g. resize finished on another page sharing the store).
  useEffect(() => {
    currentWidthRef.current = width;
    if (open) {
      if (panelRef.current) panelRef.current.style.width = `${width}px`;
      if (contentRef.current) contentRef.current.style.width = `${width}px`;
    }
  }, [width, open]);

  if (!mounted) return null;

  return (
    <>
      <div
        className={`hidden lg:block w-1 cursor-col-resize bg-transparent hover:bg-white/10 transition-[opacity,background-color] duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onMouseDown={startResize}
        title={t("studio.resizeDetailsPanel")}
        role="separator"
        aria-orientation="vertical"
        aria-label={t("studio.resizeDetailsPanel")}
      />
      <aside
        ref={panelRef}
        style={{ width: open ? width : 0 }}
        aria-hidden={!open}
        className="hidden lg:flex lg:flex-col shrink-0 overflow-hidden border-l border-white/5 bg-[#0d0d12] transition-[width] duration-300 ease-out motion-reduce:transition-none"
      >
        <div
          ref={contentRef}
          style={{ width }}
          className={`flex min-h-0 flex-1 flex-col transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${
            open ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
          }`}
        >
          {children}
        </div>
      </aside>
    </>
  );
}
