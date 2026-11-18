import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import CreateVoiceFromTrackDialog from "@/components/tracks/CreateVoiceFromTrackDialog";
import type { TrackItem } from "@/components/tracks/types";

const track = {
  id: "track-1",
  title: "Night Drive",
  status: "done",
  provider: "apimart",
  providerModel: "suno-v6",
  prompt: "synthwave",
  lyrics: "la la",
  audioUrl: "/api/audio/track-1",
  audioUrlHd: null,
  format: "mp3",
  formatHd: null,
  duration: 180,
  createdAt: "2026-11-18T10:00:00.000Z",
  error: null,
  s3KeyHd: null,
  instrumental: false,
} as TrackItem;

/** Answers by URL so the dialog's POST, status poll and rename each get theirs. */
function mockApi(overrides: Record<string, () => Response> = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const key = `${init?.method ?? "GET"} ${url}`;
    const handler =
      overrides[key] ??
      (url.includes("/api/voice/from-track")
        ? () =>
            new Response(JSON.stringify({ voice: { id: "voice-1", status: "pending" } }), {
              status: 200,
            })
        : () =>
            new Response(JSON.stringify({ voice: { id: "voice-1", status: "pending" } }), {
              status: 200,
            }));
    return handler();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("CreateVoiceFromTrackDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts a clone from the track and waits for APIMart to finish", async () => {
    const fetchMock = mockApi();
    render(<CreateVoiceFromTrackDialog isOpen onClose={vi.fn()} track={track} />);

    await act(async () => {});
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post).toBeTruthy();
    expect(JSON.parse(String(post![1]!.body))).toEqual({ trackId: "track-1" });
    expect(screen.getByText(/Extracting the voice/)).toBeTruthy();

    // No name field until the voice actually exists.
    expect(screen.queryByLabelText("Voice name")).toBeNull();
  });

  it("asks for a name once the voice is ready and saves it", async () => {
    const onClose = vi.fn();
    const rename = vi.fn(() =>
      new Response(JSON.stringify({ voice: { id: "voice-1", name: "Warm baritone" } }), {
        status: 200,
      })
    );
    const fetchMock = mockApi({
      "GET /api/voice/status/voice-1": () =>
        new Response(JSON.stringify({ voice: { id: "voice-1", status: "completed" } }), {
          status: 200,
        }),
      "PATCH /api/voice/voice-1": rename,
    });

    render(<CreateVoiceFromTrackDialog isOpen onClose={onClose} track={track} />);
    await act(async () => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    const input = screen.getByLabelText("Voice name");
    fireEvent.change(input, { target: { value: "  Warm baritone  " } });
    await act(async () => {
      fireEvent.click(screen.getByText("Save name"));
      await vi.advanceTimersByTimeAsync(0);
    });

    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patch).toBeTruthy();
    // The name is trimmed before it is stored.
    expect(JSON.parse(String(patch![1]!.body))).toEqual({ name: "Warm baritone" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed clone instead of asking for a name", async () => {
    mockApi({
      "GET /api/voice/status/voice-1": () =>
        new Response(JSON.stringify({ voice: { id: "voice-1", status: "failed", error: "No vocals detected" } }), {
          status: 200,
        }),
    });

    render(<CreateVoiceFromTrackDialog isOpen onClose={vi.fn()} track={track} />);
    await act(async () => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(screen.getByText("No vocals detected")).toBeTruthy();
    expect(screen.queryByLabelText("Voice name")).toBeNull();
  });
});
