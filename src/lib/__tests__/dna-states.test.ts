import { describe, expect, it } from "vitest";
import {
  isPulsing,
  profileSignals,
  traitState,
  traitTrend,
  PULSE_WINDOW_DAYS,
} from "@/lib/dna/states";

const NOW = new Date("2026-11-18T12:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

describe("traitState", () => {
  it("calls a trait without evidence dark", () => {
    expect(traitState(null, { now: NOW })).toBe("dark");
  });

  it("calls a low-confidence trait learning", () => {
    expect(traitState({ confidence: 0.3, lockedAt: null, lastChangedAt: daysAgo(30) }, { now: NOW })).toBe("learning");
  });

  it("calls a high-confidence trait sure", () => {
    expect(traitState({ confidence: 0.8, lockedAt: null, lastChangedAt: daysAgo(30) }, { now: NOW })).toBe("sure");
  });

  it("marks a recent change as pulsing, even when confidence is low", () => {
    expect(traitState({ confidence: 0.3, lockedAt: null, lastChangedAt: daysAgo(2) }, { now: NOW })).toBe("pulsing");
  });

  it("lets a lock win over pulsing", () => {
    expect(traitState({ confidence: 0.9, lockedAt: daysAgo(1), lastChangedAt: daysAgo(1) }, { now: NOW })).toBe("locked");
  });
});

describe("isPulsing", () => {
  it("uses a seven-day window, exclusive at the edge", () => {
    expect(isPulsing(daysAgo(6), { now: NOW })).toBe(true);
    expect(isPulsing(daysAgo(PULSE_WINDOW_DAYS), { now: NOW })).toBe(false);
    expect(isPulsing(daysAgo(30), { now: NOW })).toBe(false);
    expect(isPulsing(null, { now: NOW })).toBe(false);
  });
});

describe("traitTrend", () => {
  it("reads the last changes, newest first", () => {
    expect(traitTrend([{ direction: "up" }, { direction: "up" }, { direction: "down" }])).toBe("up");
    expect(traitTrend([{ direction: "down" }, { direction: "down" }, { direction: "up" }])).toBe("down");
  });

  it("stays steady without changes or with a tie", () => {
    expect(traitTrend([])).toBe("steady");
    expect(traitTrend([{ direction: "up" }, { direction: "down" }])).toBe("steady");
  });

  it("ignores non-numeric changes when reading a direction", () => {
    expect(traitTrend([{ direction: "changed" }, { direction: "down" }])).toBe("down");
  });
});

describe("profileSignals", () => {
  it("counts songs, corrections and calibration duels", () => {
    const signals = profileSignals({
      sourceCount: 1404,
      feedbackKinds: ["confirm", "reset", "more", "less", "reject"],
      calibrationAnswers: 40,
    });
    // reset only undoes a correction, so it is not a signal of its own.
    expect(signals).toMatchObject({ songs: 1404, edits: 4, calibrations: 40 });
  });

  it("formats the line the DNA page shows", () => {
    const signals = profileSignals({ sourceCount: 1200, feedbackKinds: [], calibrationAnswers: 2 });
    expect(signals.label).toBe("1200 songs · 0 edits · 2 calibrations");
  });
});
