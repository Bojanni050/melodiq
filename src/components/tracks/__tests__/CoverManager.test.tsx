import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import CoverManager from "@/components/tracks/CoverManager";

type Cover = {
  id: string;
  entityType: string;
  entityId: string;
  s3Key: string;
  s3KeyThumb: string | null;
  position: number;
  isMain: boolean;
  isGenerated: boolean;
  createdAt: string;
};

function cover(overrides: Partial<Cover> = {}): Cover {
  return {
    id: "c1",
    entityType: "release",
    entityId: "r1",
    s3Key: "releases/r1/covers/c1.webp",
    s3KeyThumb: "releases/r1/covers/c1_thumb.webp",
    position: 0,
    isMain: false,
    isGenerated: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function mockCovers(covers: Cover[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ covers }) })) as unknown as typeof fetch
  );
}

function renderManager(covers: Cover[]) {
  return render(
    <CoverManager
      entityType="release"
      entityId="r1"
      currentCoverS3Key="releases/r1/cover.webp"
      onClose={() => {}}
    />
  );
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CoverManager — a release that already has a cover", () => {
  it("keeps the release's own cover marked Main when an upload is added alongside it", async () => {
    // What the server now returns after an upload: the new cover is stored, but
    // it does not claim isMain and the release's own cover is untouched.
    mockCovers([cover({ id: "uploaded", isMain: false, position: 0 })]);
    renderManager([]);

    await waitFor(() => expect(screen.getByText("Original")).toBeTruthy());

    // Exactly one Main badge, and it belongs to the Original tile — an uploaded
    // cover taking it over is the regression this guards.
    const mainBadges = screen.getAllByText("Main");
    expect(mainBadges).toHaveLength(1);

    const originalTile = screen.getByText("Original").closest("div");
    expect(originalTile?.textContent).toContain("Main");
  });

  it("counts the original plus the uploaded cover", async () => {
    mockCovers([cover({ id: "uploaded", isMain: false })]);
    renderManager([]);

    await waitFor(() => expect(screen.getByText(/Release Cover Images/)).toBeTruthy());
    expect(screen.getByText("Release Cover Images (2/5)")).toBeTruthy();
  });

  it("moves the Main badge to an uploaded cover only once it has been promoted", async () => {
    mockCovers([cover({ id: "promoted", isMain: true })]);
    renderManager([]);

    await waitFor(() => expect(screen.getByText("Original")).toBeTruthy());

    const originalTile = screen.getByText("Original").closest("div");
    expect(originalTile?.textContent).not.toContain("Main");
    expect(screen.getAllByText("Main")).toHaveLength(1);
  });

  it("offers Set as main for a cover that is not main, and not for one that is", async () => {
    mockCovers([cover({ id: "a", isMain: false, position: 0 }), cover({ id: "b", isMain: true, position: 1 })]);
    renderManager([]);

    await waitFor(() => expect(screen.getByText("Original")).toBeTruthy());
    expect(screen.getAllByTitle("Set as main")).toHaveLength(1);
  });
});
