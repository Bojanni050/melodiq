import { describe, expect, it } from "vitest";
import { normalizeTclAutoGenerate } from "@/lib/tcl/auto-generate";

describe("normalizeTclAutoGenerate", () => {
  it("stays on when the setting was never saved", () => {
    expect(normalizeTclAutoGenerate(undefined)).toBe(true);
    expect(normalizeTclAutoGenerate(null)).toBe(true);
    expect(normalizeTclAutoGenerate("")).toBe(true);
  });

  it("treats anything but the literal false as on, matching pre-switch behaviour", () => {
    expect(normalizeTclAutoGenerate("true")).toBe(true);
    expect(normalizeTclAutoGenerate("0")).toBe(true);
    expect(normalizeTclAutoGenerate("off")).toBe(true);
  });

  it("is off only for the value the settings switch writes", () => {
    expect(normalizeTclAutoGenerate("false")).toBe(false);
  });
});
