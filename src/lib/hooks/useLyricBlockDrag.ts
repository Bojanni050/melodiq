"use client";

import { useEffect, useRef, useState } from "react";
import type { LyricBlock } from "@/lib/lyrics-utils";

export function useLyricBlockDrag(setBlocks: React.Dispatch<React.SetStateAction<LyricBlock[]>>) {
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: "before" | "after" } | null>(null);
  const dragStateRef = useRef<{ pointerId: number; blockId: string } | null>(null);
  const dropTargetRef = useRef<{ id: string; position: "before" | "after" } | null>(null);

  function updateDragTarget(clientX: number, clientY: number, draggingId: string) {
    let blockElement: HTMLElement | null = null;
    try {
      const hovered = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      blockElement = hovered?.closest<HTMLElement>("[data-lyric-block-id]") ?? null;
    } catch {}

    if (!blockElement) {
      const all = Array.from(document.querySelectorAll("[data-lyric-block-id]")) as HTMLElement[];
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
          blockElement = el;
          break;
        }
      }
    }

    const targetId = blockElement?.dataset.lyricBlockId;
    if (!targetId || targetId === draggingId || !blockElement) {
      dropTargetRef.current = null;
      setDropTarget(null);
      return;
    }

    const rect = blockElement.getBoundingClientRect();
    const position = clientY < rect.top + rect.height / 2 ? "before" : "after";
    dropTargetRef.current = { id: targetId, position };
    setDropTarget({ id: targetId, position });
  }

  function shouldIgnoreDragStart(target: EventTarget | null) {
    const element = target instanceof HTMLElement ? target : null;
    return Boolean(element?.closest("input, textarea, button, select, option, label, a"));
  }

  function startBlockDrag(event: React.PointerEvent<HTMLButtonElement>, blockId: string) {
    event.preventDefault();
    event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    dragStateRef.current = { pointerId: event.pointerId, blockId };
    setDraggedBlockId(blockId);
    setDropTarget(null);
  }

  function startBlockDragFromCard(event: React.PointerEvent<HTMLElement>, blockId: string) {
    if (shouldIgnoreDragStart(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    dragStateRef.current = { pointerId: event.pointerId, blockId };
    setDraggedBlockId(blockId);
    setDropTarget(null);
  }

  useEffect(() => {
    if (!draggedBlockId) return;

    function handlePointerMove(event: PointerEvent) {
      if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) return;
      updateDragTarget(event.clientX, event.clientY, dragStateRef.current.blockId);
    }

    function finishDrag(event: PointerEvent) {
      if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) return;

      const activeDrag = dragStateRef.current;
      const currentDropTarget = dropTargetRef.current;

      if (currentDropTarget) {
        setBlocks((current) => {
          const targetIndex = current.findIndex((b) => b.id === currentDropTarget.id);
          if (targetIndex >= 0) {
            const fromIndex = current.findIndex((b) => b.id === activeDrag.blockId);
            if (fromIndex >= 0) {
              const bounded = Math.max(0, Math.min(
                currentDropTarget.position === "before" ? targetIndex : targetIndex + 1,
                current.length
              ));
              const adjusted = fromIndex < bounded ? bounded - 1 : bounded;
              if (adjusted !== fromIndex) {
                const next = [...current];
                const [block] = next.splice(fromIndex, 1);
                next.splice(adjusted, 0, block);
                return next;
              }
            }
          }
          return current;
        });
      }

      dragStateRef.current = null;
      dropTargetRef.current = null;
      setDraggedBlockId(null);
      setDropTarget(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [draggedBlockId, setBlocks]);

  return { draggedBlockId, dropTarget, startBlockDrag, startBlockDragFromCard };
}
