import { describe, expect, it, vi } from "vitest";

import { mapInBatches, normalizeConcurrency } from "../batch";

describe("normalizeConcurrency", () => {
  it("defaults when the caller sends nothing usable", () => {
    expect(normalizeConcurrency(undefined)).toBe(3);
    expect(normalizeConcurrency(0)).toBe(3);
    expect(normalizeConcurrency(-2)).toBe(3);
    expect(normalizeConcurrency("nope")).toBe(3);
    expect(normalizeConcurrency(Number.NaN)).toBe(3);
  });

  it("clamps to the maximum and floors fractions", () => {
    expect(normalizeConcurrency(2)).toBe(2);
    expect(normalizeConcurrency(4.7)).toBe(4);
    expect(normalizeConcurrency(99)).toBe(8);
    expect(normalizeConcurrency(99, 3, 5)).toBe(5);
  });
});

describe("mapInBatches", () => {
  it("keeps the input order in the results", async () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const results = await mapInBatches(items, 3, async (item) => item * 2);
    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });

  it("never runs more than `size` workers at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const tasks = Array.from({ length: 10 }, (_, index) => index);

    await mapInBatches(tasks, 3, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      return null;
    });

    expect(peak).toBe(3);
  });

  it("passes the original index and runs sequentially across batches", async () => {
    const seen: number[] = [];
    await mapInBatches(["a", "b", "c"], 2, async (_item, index) => {
      seen.push(index);
      return index;
    });
    expect(seen.sort()).toEqual([0, 1, 2]);
  });

  it("propagates a worker failure (the caller decides what one failure means)", async () => {
    await expect(
      mapInBatches([1, 2, 3], 2, async (item) => {
        if (item === 2) throw new Error("boom");
        return item;
      })
    ).rejects.toThrow("boom");
  });

  it("returns an empty array for no work", async () => {
    const worker = vi.fn();
    expect(await mapInBatches([], 3, worker)).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });
});
