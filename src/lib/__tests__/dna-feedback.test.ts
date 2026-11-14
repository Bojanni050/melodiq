import { describe, expect, it } from "vitest";

import {
  applyFeedback,
  CONFIRM_BOOST,
  foldFeedback,
  isDnaFeedbackKind,
  type DnaFeedbackEvent,
} from "../dna/feedback";

function event(traitKey: string, kind: DnaFeedbackEvent["kind"], minute: number): DnaFeedbackEvent {
  return {
    traitKey,
    kind,
    createdAt: new Date(Date.UTC(2026, 0, 1, 12, minute)).toISOString(),
  };
}

describe("foldFeedback", () => {
  it("returns no stances without events", () => {
    expect(foldFeedback([]).size).toBe(0);
  });

  it("turns a confirm into a verdict", () => {
    const stances = foldFeedback([event("tempo", "confirm", 1)]);
    expect(stances.get("tempo")).toMatchObject({
      traitKey: "tempo",
      verdict: "confirm",
      direction: null,
    });
  });

  it("applies events in chronological order, not input order", () => {
    const stances = foldFeedback([event("tempo", "confirm", 5), event("tempo", "reject", 2)]);
    expect(stances.get("tempo")?.verdict).toBe("confirm");
  });

  it("keeps verdict and direction independent", () => {
    const stances = foldFeedback([event("genres", "confirm", 1), event("genres", "less", 2)]);
    expect(stances.get("genres")).toMatchObject({ verdict: "confirm", direction: "less" });
  });

  it("lets a later direction replace an earlier one", () => {
    const stances = foldFeedback([event("energy", "more", 1), event("energy", "less", 2)]);
    expect(stances.get("energy")?.direction).toBe("less");
  });

  it("drops the stance when a reset clears everything", () => {
    const stances = foldFeedback([
      event("tempo", "confirm", 1),
      event("tempo", "more", 2),
      event("tempo", "reset", 3),
    ]);
    expect(stances.has("tempo")).toBe(false);
  });

  it("only clears one trait on reset", () => {
    const stances = foldFeedback([
      event("tempo", "confirm", 1),
      event("energy", "reject", 2),
      event("tempo", "reset", 3),
    ]);
    expect(stances.has("tempo")).toBe(false);
    expect(stances.get("energy")?.verdict).toBe("reject");
  });

  it("records when the current stance was set", () => {
    const stances = foldFeedback([event("tempo", "confirm", 1), event("tempo", "reject", 3)]);
    expect(stances.get("tempo")?.updatedAt).toBe(new Date(Date.UTC(2026, 0, 1, 12, 3)).toISOString());
  });

  it("ignores events without a trait key", () => {
    const stances = foldFeedback([{ traitKey: "", kind: "confirm", createdAt: new Date() }]);
    expect(stances.size).toBe(0);
  });
});

describe("applyFeedback", () => {
  it("leaves confidence alone without a stance", () => {
    expect(applyFeedback(0.62, undefined)).toEqual({ confidence: 0.62, verdict: null, direction: null });
  });

  it("moves a confirmed trait part of the way toward certainty", () => {
    const result = applyFeedback(0.2, {
      traitKey: "tempo",
      verdict: "confirm",
      direction: null,
      updatedAt: null,
    });
    expect(result.confidence).toBeCloseTo(0.2 + 0.8 * CONFIRM_BOOST, 5);
    expect(result.verdict).toBe("confirmed");
  });

  it("cannot push confidence past 1", () => {
    const result = applyFeedback(1, {
      traitKey: "tempo",
      verdict: "confirm",
      direction: null,
      updatedAt: null,
    });
    expect(result.confidence).toBe(1);
  });

  it("cuts a rejected trait below the solid threshold", () => {
    const result = applyFeedback(0.9, {
      traitKey: "genres",
      verdict: "reject",
      direction: null,
      updatedAt: null,
    });
    // Rounded to two decimals like every stored confidence (0.315 → 0.32).
    expect(result.confidence).toBe(0.32);
    expect(result.confidence).toBeLessThan(0.45);
    expect(result.verdict).toBe("disputed");
  });

  it("keeps confidence at zero when rejected", () => {
    const result = applyFeedback(0, {
      traitKey: "genres",
      verdict: "reject",
      direction: null,
      updatedAt: null,
    });
    expect(result.confidence).toBe(0);
  });

  it("does not treat a direction as evidence", () => {
    const result = applyFeedback(0.5, {
      traitKey: "energy",
      verdict: null,
      direction: "more",
      updatedAt: null,
    });
    expect(result).toEqual({ confidence: 0.5, verdict: null, direction: "more" });
  });
});

describe("isDnaFeedbackKind", () => {
  it("accepts the five supported actions", () => {
    for (const kind of ["confirm", "reject", "more", "less", "reset"]) {
      expect(isDnaFeedbackKind(kind)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isDnaFeedbackKind("love")).toBe(false);
    expect(isDnaFeedbackKind(null)).toBe(false);
    expect(isDnaFeedbackKind(42)).toBe(false);
  });
});
