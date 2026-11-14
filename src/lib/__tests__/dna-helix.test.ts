import { describe, expect, it } from "vitest";
import {
  HELIX_CENTER_X,
  HELIX_PADDING_Y,
  HELIX_RADIUS,
  HELIX_WIDTH,
  buildHelixLayout,
  categoryGapIndices,
  nodeRadius,
  toPath,
  truncate,
} from "../dna/helix";

const trait = (key: string, category = "sound", confidence = 0.6) => ({
  key,
  category,
  label: key,
  display: `${key} value`,
  confidence,
  verdict: null,
  direction: null,
});

describe("buildHelixLayout", () => {
  it("returns an empty shape for no traits", () => {
    const layout = buildHelixLayout([]);
    expect(layout.nodes).toEqual([]);
    expect(layout.leftStrand).toEqual([]);
    expect(layout.rightStrand).toEqual([]);
    expect(layout.height).toBe(HELIX_PADDING_Y * 2);
    expect(layout.width).toBe(HELIX_WIDTH);
  });

  it("creates one node and one rung per trait", () => {
    const layout = buildHelixLayout([trait("a"), trait("b"), trait("c")]);
    expect(layout.nodes).toHaveLength(3);
    expect(layout.nodes.map((node) => node.key)).toEqual(["a", "b", "c"]);
    for (const node of layout.nodes) {
      expect(node.rung.x1).toBeGreaterThan(HELIX_CENTER_X - HELIX_RADIUS - 0.001);
      expect(node.rung.x2).toBeLessThan(HELIX_CENTER_X + HELIX_RADIUS + 0.001);
    }
  });

  it("keeps every node inside the canvas and depth within the unit range", () => {
    const layout = buildHelixLayout([trait("a"), trait("b"), trait("c"), trait("d")]);
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(HELIX_WIDTH);
      expect(node.depth).toBeGreaterThanOrEqual(-1);
      expect(node.depth).toBeLessThanOrEqual(1);
    }
  });

  it("puts the node on the front-most strand", () => {
    const layout = buildHelixLayout([trait("a"), trait("b")]);
    for (const node of layout.nodes) {
      const expected = node.depth >= 0 ? node.rung.x1 : node.rung.x2;
      expect(node.x).toBeCloseTo(expected, 5);
    }
  });

  it("adds vertical space where a new category starts", () => {
    const traits = [trait("a"), trait("b", "voice"), trait("c", "structure")];
    const flat = buildHelixLayout(traits);
    const grouped = buildHelixLayout(traits, 0, categoryGapIndices(traits));

    const flatGap = flat.nodes[1].y - flat.nodes[0].y;
    const groupedGap = grouped.nodes[1].y - grouped.nodes[0].y;
    expect(groupedGap).toBeGreaterThan(flatGap);
    expect(grouped.height).toBeGreaterThan(flat.height);
  });

  it("is deterministic for the same input", () => {
    const traits = [trait("a"), trait("b")];
    const first = buildHelixLayout(traits, 1.2, [1]);
    const second = buildHelixLayout(traits, 1.2, [1]);
    expect(second).toEqual(first);
  });

  it("rotates horizontally without changing rods' height", () => {
    const traits = [trait("a"), trait("b")];
    const still = buildHelixLayout(traits, 0);
    const turned = buildHelixLayout(traits, Math.PI / 2);
    expect(turned.nodes.map((node) => node.y)).toEqual(still.nodes.map((node) => node.y));
    expect(turned.nodes.map((node) => node.x)).not.toEqual(still.nodes.map((node) => node.x));
  });

  it("samples both strands between rungs", () => {
    const layout = buildHelixLayout([trait("a"), trait("b"), trait("c")]);
    expect(layout.leftStrand.length).toBeGreaterThan(layout.nodes.length);
    expect(layout.rightStrand.length).toBe(layout.leftStrand.length);
  });
});

describe("categoryGapIndices", () => {
  it("marks the first trait of every new category", () => {
    expect(
      categoryGapIndices([
        { category: "sound" },
        { category: "sound" },
        { category: "voice" },
        { category: "words" },
      ])
    ).toEqual([2, 3]);
  });

  it("returns nothing for a single group", () => {
    expect(categoryGapIndices([{ category: "sound" }, { category: "sound" }])).toEqual([]);
    expect(categoryGapIndices([])).toEqual([]);
  });
});

describe("toPath", () => {
  it("returns an empty string without points", () => {
    expect(toPath([])).toBe("");
  });

  it("moves first and lines the rest", () => {
    const path = toPath([
      { x: 1, y: 2 },
      { x: 3.456, y: 4 },
    ]);
    expect(path).toBe("M1.00 2.00 L3.46 4.00");
  });
});

describe("truncate", () => {
  it("leaves short text alone", () => {
    expect(truncate("tempo", 10)).toBe("tempo");
  });

  it("shortens long text with an ellipsis inside the limit", () => {
    const result = truncate("a very long trait label", 10);
    expect(result).toHaveLength(10);
    expect(result.endsWith("…")).toBe(true);
  });

  it("handles a zero limit", () => {
    expect(truncate("tempo", 0)).toBe("");
  });
});

describe("nodeRadius", () => {
  it("draws front nodes larger than back nodes", () => {
    expect(nodeRadius(1)).toBeGreaterThan(nodeRadius(-1));
    expect(nodeRadius(0)).toBeGreaterThan(nodeRadius(-1));
  });
});
