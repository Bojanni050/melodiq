"use client";

import { useEffect } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex='0']",
  "[role='button']",
].join(",");

function getVisible(elements: Element[]): HTMLElement[] {
  return elements.filter((el): el is HTMLElement => {
    const h = el as HTMLElement;
    return h.offsetParent !== null && getComputedStyle(h).visibility !== "hidden";
  });
}

function center(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function findNearest(current: HTMLElement, all: HTMLElement[], key: string): HTMLElement | null {
  const cc = center(current);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of all) {
    if (el === current) continue;
    const ec = center(el);
    const dx = ec.x - cc.x;
    const dy = ec.y - cc.y;

    let inDir = false;
    let primary = 0;
    let secondary = 0;

    if (key === "ArrowRight") { inDir = dx > 2; primary = dx; secondary = Math.abs(dy); }
    else if (key === "ArrowLeft")  { inDir = dx < -2; primary = -dx; secondary = Math.abs(dy); }
    else if (key === "ArrowDown")  { inDir = dy > 2; primary = dy; secondary = Math.abs(dx); }
    else if (key === "ArrowUp")    { inDir = dy < -2; primary = -dy; secondary = Math.abs(dx); }

    if (!inDir) continue;
    const score = primary + secondary * 3;
    if (score < bestScore) { bestScore = score; best = el; }
  }

  return best;
}

export function useDpadNavigation() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (!arrows.includes(e.key)) return;

      // Don't hijack inside text inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const all = getVisible(Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)));
      if (all.length === 0) return;

      const current = document.activeElement as HTMLElement;

      if (!all.includes(current)) {
        // Nothing focused yet — pick the first visible element
        all[0].focus();
        e.preventDefault();
        return;
      }

      const next = findNearest(current, all, e.key);
      if (next) {
        next.focus();
        next.scrollIntoView({ block: "nearest", behavior: "smooth" });
        e.preventDefault();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
