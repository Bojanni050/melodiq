import { describe, expect, it } from "vitest";
import {
  HELIX_CAMERA,
  HELIX_CENTER_X,
  HELIX_PADDING_Y,
  HELIX_RADIUS,
  HELIX_WIDTH,
  buildHelixScene,
  categoryGapIndices,
  estimateTextWidth,
  fitHelixLabel,
  nodeRadius,
  strandWidth,
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

/** Widest a projected point can get, so tests can assert the canvas bounds. */
const MAX_SCALE = HELIX_CAMERA / (HELIX_CAMERA - HELIX_RADIUS);

describe("buildHelixScene", () => {
  it("returns an empty shape for no traits", () => {
    const scene = buildHelixScene([]);
    expect(scene.nodes).toEqual([]);
    expect(scene.segments).toEqual([]);
    expect(scene.height).toBe(HELIX_PADDING_Y * 2);
    expect(scene.width).toBe(HELIX_WIDTH);
  });

  it("creates one node and one rung per trait", () => {
    // A slight rotation keeps the first rung from being viewed exactly edge-on.
    const scene = buildHelixScene([trait("a"), trait("b"), trait("c")], 0.4);
    expect(scene.nodes).toHaveLength(3);
    expect(scene.nodes.map((node) => node.key)).toEqual(["a", "b", "c"]);
    for (const node of scene.nodes) {
      // The rung spans the cylinder, so its ends sit on opposite sides.
      expect(node.rung.x1).not.toBeCloseTo(node.rung.x2, 3);
      expect(node.rung.x1).toBeGreaterThan(HELIX_CENTER_X - HELIX_RADIUS * MAX_SCALE - 0.001);
      expect(node.rung.x2).toBeLessThan(HELIX_CENTER_X + HELIX_RADIUS * MAX_SCALE + 0.001);
    }
  });

  it("keeps every node inside the canvas and depth within the unit range", () => {
    const scene = buildHelixScene([trait("a"), trait("b"), trait("c"), trait("d")]);
    for (const node of scene.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(HELIX_WIDTH);
      expect(node.depth).toBeGreaterThanOrEqual(-1);
      expect(node.depth).toBeLessThanOrEqual(1);
    }
  });

  it("puts the node on the nearer end of the rung", () => {
    const scene = buildHelixScene([trait("a"), trait("b")]);
    for (const node of scene.nodes) {
      // The front end is whichever projection ended up closer to the viewer.
      expect(node.depth).toBeGreaterThanOrEqual(0);
      const rungX = [node.rung.x1, node.rung.x2];
      expect(rungX.some((x) => Math.abs(x - node.x) < 0.001)).toBe(true);
    }
  });

  it("projects the near end further from the axis than the far end", () => {
    const scene = buildHelixScene([trait("a"), trait("b"), trait("c")], 0.4);
    for (const node of scene.nodes) {
      const frontDistance = Math.abs(node.x - HELIX_CENTER_X);
      const backDistance = Math.abs(node.back.x - HELIX_CENTER_X);
      expect(frontDistance).toBeGreaterThanOrEqual(backDistance - 0.001);
    }
  });

  it("adds vertical space where a new category starts", () => {
    const traits = [trait("a"), trait("b", "voice"), trait("c", "structure")];
    const flat = buildHelixScene(traits);
    const grouped = buildHelixScene(traits, 0, categoryGapIndices(traits));

    const flatGap = flat.nodes[1].y - flat.nodes[0].y;
    const groupedGap = grouped.nodes[1].y - grouped.nodes[0].y;
    expect(groupedGap).toBeGreaterThan(flatGap);
    expect(grouped.height).toBeGreaterThan(flat.height);
  });

  it("is deterministic for the same input", () => {
    const traits = [trait("a"), trait("b")];
    const first = buildHelixScene(traits, 1.2, [1]);
    const second = buildHelixScene(traits, 1.2, [1]);
    expect(second).toEqual(first);
  });

  it("rotates horizontally without changing the row heights", () => {
    const traits = [trait("a"), trait("b")];
    const still = buildHelixScene(traits, 0);
    const turned = buildHelixScene(traits, Math.PI / 2);
    expect(turned.nodes.map((node) => node.y)).toEqual(still.nodes.map((node) => node.y));
    expect(turned.nodes.map((node) => node.x)).not.toEqual(still.nodes.map((node) => node.x));
  });

  it("draws both strands as depth-sorted segments", () => {
    const scene = buildHelixScene([trait("a"), trait("b"), trait("c")]);
    expect(scene.segments.length).toBeGreaterThan(scene.nodes.length);
    const depths = scene.segments.map((segment) => segment.depth);
    expect(depths).toEqual([...depths].sort((left, right) => left - right));
    // With a full turn the segments reach both the near and the far side.
    expect(Math.max(...depths)).toBeGreaterThan(0.5);
    expect(Math.min(...depths)).toBeLessThan(-0.5);
  });

  it("still renders a strand for a single trait", () => {
    const scene = buildHelixScene([trait("a")]);
    expect(scene.nodes).toHaveLength(1);
    expect(scene.segments.length).toBeGreaterThan(0);
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

describe("depth styling", () => {
  it("draws front nodes larger than back nodes", () => {
    expect(nodeRadius(1)).toBeGreaterThan(nodeRadius(-1));
    expect(nodeRadius(0)).toBeGreaterThan(nodeRadius(-1));
  });

  it("thickens the strand as it comes closer", () => {
    expect(strandWidth(1)).toBeGreaterThan(strandWidth(0));
    expect(strandWidth(0)).toBeGreaterThan(strandWidth(-1));
  });
});

describe("label pills", () => {
  it("leaves a label that already fits untouched", () => {
    const fit = fitHelixLabel("Tempo (BPM)", "91.6", 220);
    expect(fit.label).toBe("Tempo (BPM)");
    expect(fit.display).toBe("91.6");
    expect(fit.width).toBeLessThanOrEqual(220);
  });

  it("shortens the value before the label", () => {
    const fit = fitHelixLabel("Signature instruments", "expressive synth-lead arpeggios", 240);
    expect(fit.label).toBe("Signature instruments");
    expect(fit.display.length).toBeLessThan("expressive synth-lead arpeggios".length);
    expect(fit.width).toBeLessThanOrEqual(240);
  });

  it("then shortens the label itself", () => {
    const fit = fitHelixLabel("A very long trait name that cannot fit", "value", 120);
    expect(fit.label.length).toBeLessThan("A very long trait name that cannot fit".length);
    expect(fit.width).toBeLessThanOrEqual(120);
  });

  it("drops the value entirely when only the label fits", () => {
    const fit = fitHelixLabel("Tempo (BPM)", "91.6", 80);
    expect(fit.display).toBe("");
    expect(fit.width).toBeLessThanOrEqual(80);
  });

  it("estimates wider text for bold and longer strings", () => {
    expect(estimateTextWidth("tempo", 12, true)).toBeGreaterThan(estimateTextWidth("tempo", 12));
    expect(estimateTextWidth("tempo", 12)).toBeGreaterThan(estimateTextWidth("tem", 12));
  });
});
