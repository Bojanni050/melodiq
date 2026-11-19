import { describe, expect, it } from "vitest";

import { classifyEnergyArc } from "../dna/arc";

describe("classifyEnergyArc", () => {
  it("abstains without enough buckets", () => {
    expect(classifyEnergyArc(null)).toBeNull();
    expect(classifyEnergyArc([10, 20, 30])).toBeNull();
  });

  it("calls a rising arc a build", () => {
    expect(classifyEnergyArc([10, 18, 26, 34, 42, 50, 58, 66, 74, 82])).toBe("builds");
  });

  it("calls a falling arc a strong start", () => {
    expect(classifyEnergyArc([90, 82, 74, 66, 58, 50, 42, 34, 26, 18])).toBe("starts strong");
  });

  it("keeps a flat arc steady", () => {
    expect(classifyEnergyArc([50, 52, 49, 51, 50, 50, 52, 49, 50, 51])).toBe("steady");
  });

  it("reads a late peak as a build and an early peak as a strong start", () => {
    expect(classifyEnergyArc([40, 38, 42, 40, 39, 41, 40, 45, 70, 88])).toBe("builds");
    expect(classifyEnergyArc([88, 70, 45, 40, 41, 39, 40, 42, 38, 40])).toBe("starts strong");
  });
});
