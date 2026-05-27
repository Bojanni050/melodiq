"use client";

import { useEffect, useRef, useState } from "react";
import type { LyricBlock } from "@/lib/lyrics-utils";

export function useLyricBlockDrag(setBlocks: React.Dispatch<React.SetStateAction<LyricBlock[]>>) {
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: "before" | "after" } | null>(null);
  const dragStateRef = useRef<{ pointerId?: number; blockId: string; kind: "pointer" | "mouse" } | null>(null);
  const dropTargetRef = useRef<{ id: string; position: "before" | "after" } | null>(null);

  function updateDragTarget(clientX: number, clientY: number, draggingId: string) {
    const all = Array.from(document.querySelectorAll("[data-lyric-block-id]")) as HTMLElement[];
    const candidates = all
      .filter((element) => element.dataset.lyricBlockId && element.dataset.lyricBlockId !== draggingId)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element,
          rect,
          midpoint: rect.top + rect.height / 2,
        };
      })
      .sort((left, right) => left.rect.top - right.rect.top || left.rect.left - right.rect.left);

    if (candidates.length === 0) {
      dropTargetRef.current = null;
      setDropTarget(null);
      return;
    }

    const hovered = candidates.find(({ rect }) =>
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom,
    );

    const targetCandidate = hovered ?? candidates.find(({ midpoint }) => clientY < midpoint) ?? candidates[candidates.length - 1];
    const targetId = targetCandidate.element.dataset.lyricBlockId;
    if (!targetId) {
      dropTargetRef.current = null;
      setDropTarget(null);
      return;
    }

    const position = clientY < targetCandidate.midpoint ? "before" : "after";
    dropTargetRef.current = { id: targetId, position };
    setDropTarget({ id: targetId, position });
  }

  function shouldIgnoreDragStart(target: EventTarget | null) {
    const element = target instanceof HTMLElement ? target : null;
    return Boolean(element?.closest("input, textarea, button, select, option, label, a"));
  }

  function beginDrag(blockId: string, kind: "pointer" | "mouse", pointerId?: number) {
    dragStateRef.current = { pointerId, blockId, kind };
    setDraggedBlockId(blockId);
    setDropTarget(null);
  }

  function endDrag() {
    dragStateRef.current = null;
    dropTargetRef.current = null;
    setDraggedBlockId(null);
    setDropTarget(null);
  }

  function finalizeDrag() {
    const activeDrag = dragStateRef.current;
    const currentDropTarget = dropTargetRef.current;

    if (activeDrag && currentDropTarget) {
      setBlocks((current) => {
        const targetIndex = current.findIndex((b) => b.id === currentDropTarget.id);
        if (targetIndex >= 0) {
          const fromIndex = current.findIndex((b) => b.id === activeDrag.blockId);
          if (fromIndex >= 0) {
            const bounded = Math.max(
              0,
              Math.min(
                currentDropTarget.position === "before" ? targetIndex : targetIndex + 1,
                current.length,
              ),
            );
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

    endDrag();
  }

  function startBlockDrag(event: React.PointerEvent<HTMLButtonElement>, blockId: string) {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    beginDrag(blockId, "pointer", event.pointerId);
  }

  function startBlockDragFromCard(event: React.PointerEvent<HTMLElement>, blockId: string) {
    if (event.pointerType === "mouse") return;
    if (shouldIgnoreDragStart(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    beginDrag(blockId, "pointer", event.pointerId);
  }

  function startBlockMouseDrag(event: React.DragEvent<HTMLElement>, blockId: string) {
    if (shouldIgnoreDragStart(event.target)) return;
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", blockId);
    beginDrag(blockId, "mouse");
  }

  function handleBlockMouseDragOver(event: React.DragEvent<HTMLElement>, blockId: string) {
    if (!dragStateRef.current || dragStateRef.current.kind !== "mouse") return;
    event.preventDefault();
    updateDragTarget(event.clientX, event.clientY, dragStateRef.current.blockId);
    if (dropTargetRef.current?.id !== blockId) {
      event.dataTransfer.dropEffect = "move";
    }
  }

  function handleBlockMouseDrop(event: React.DragEvent<HTMLElement>, blockId: string) {
    if (!dragStateRef.current || dragStateRef.current.kind !== "mouse") return;
    event.preventDefault();
    updateDragTarget(event.clientX, event.clientY, dragStateRef.current.blockId);
    finalizeDrag();
  }

  function handleBlockMouseDragEnd() {
    if (dragStateRef.current?.kind === "mouse") {
      endDrag();
    }
  }

  useEffect(() => {
    if (!draggedBlockId) return;

    function handlePointerMove(event: PointerEvent) {
      if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) return;
      updateDragTarget(event.clientX, event.clientY, dragStateRef.current.blockId);
    }

    function finishDrag(event: PointerEvent) {
      if (!dragStateRef.current || dragStateRef.current.kind !== "pointer" || dragStateRef.current.pointerId !== event.pointerId) return;
      finalizeDrag();
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

  return { draggedBlockId, dropTarget, startBlockDrag, startBlockDragFromCard, startBlockMouseDrag, handleBlockMouseDragOver, handleBlockMouseDrop, handleBlockMouseDragEnd };
}
