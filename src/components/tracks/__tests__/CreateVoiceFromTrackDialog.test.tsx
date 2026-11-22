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

/** Answers by URL so the dialog's POST and status poll each get theirs. */
function mockApi(overrides: Record<string, () => Response> = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const key = `${init?.method ?? "GET"} ${url}`;
    const handler =
      overrides[key] ??
      (() =>
        new Response(JSON.stringify({ voice: { id: "voice-1", status: "pending" } }), {
          status: 200,
        }));
    return handler();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function submitForm() {
  await act(async () => {
    fireEvent.click(screen.getByText("Create voice"));
  });
}

describe("CreateVoiceFromTrackDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("asks for the name and descriptors before submitting and sends them along", async () => {
    const fetchMock = mockApi();
    render(<CreateVoiceFromTrackDialog isOpen onClose={vi.fn()} track={track} />);
    await act(async () => {});

    // Nothing is sent until the user confirms the metadata: APIMart stores it
    // on the persona at creation, so asking afterwards would be too late.
    expect(fetchMock.mock.calls).toHaveLength(0);

    const nameInput = screen.getByLabelText("Voice name") as HTMLInputElement;
    expect(nameInput.value).toBe("Night Drive");

    fireEvent.change(screen.getByLabelText(/^Styles/), { target: { value: "  soul  " } });
    fireEvent.change(screen.getByLabelText(/^Description/), {
      target: { value: "  Warm and close  " },
    });

    await submitForm();

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post).toBeTruthy();
    expect(JSON.parse(String(post![1]!.body))).toEqual({
      trackId: "track-1",
      name: "Night Drive",
      styles: "soul",
      describe: "Warm and close",
    });
    expect(screen.getByText(/Extracting the voice/)).toBeTruthy();
  });

  it("does not submit without a name", async () => {
    const fetchMock = mockApi();
    render(<CreateVoiceFromTrackDialog isOpen onClose={vi.fn()} track={track} />);
    await act(async () => {});

    fireEvent.change(screen.getByLabelText("Voice name"), { target: { value: "   " } });

    const create = screen.getByText("Create voice") as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    expect(fetchMock.mock.calls).toHaveLength(0);
  });

  it("says the voice is ready once APIMart finishes", async () => {
    mockApi({
      "GET /api/voice/status/voice-1": () =>
        new Response(JSON.stringify({ voice: { id: "voice-1", status: "completed" } }), {
          status: 200,
        }),
    });

    render(<CreateVoiceFromTrackDialog isOpen onClose={vi.fn()} track={track} />);
    await act(async () => {});
    await submitForm();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(screen.getByText(/is ready\. Pick it in the Studio/)).toBeTruthy();
    // The form is gone; the metadata was already stored on the persona.
    expect(screen.queryByLabelText("Voice name")).toBeNull();
  });

  it("surfaces a failed clone instead of claiming it is ready", async () => {
    mockApi({
      "GET /api/voice/status/voice-1": () =>
        new Response(JSON.stringify({ voice: { id: "voice-1", status: "failed", error: "No vocals detected" } }), {
          status: 200,
        }),
    });

    render(<CreateVoiceFromTrackDialog isOpen onClose={vi.fn()} track={track} />);
    await act(async () => {});
    await submitForm();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(screen.getByText("No vocals detected")).toBeTruthy();
    expect(screen.queryByText(/is ready\. Pick it in the Studio/)).toBeNull();
  });

  it("keeps polling while the task is still pending", async () => {
    // A pending answer changes nothing in the dialog, so a one-shot poll would
    // stop right here and the dialog would hang forever.
    let polls = 0;
    const fetchMock = mockApi({
      "GET /api/voice/status/voice-1": () => {
        polls += 1;
        return new Response(JSON.stringify({ voice: { id: "voice-1", status: "pending" } }), {
          status: 200,
        });
      },
    });

    render(<CreateVoiceFromTrackDialog isOpen onClose={vi.fn()} track={track} />);
    await act(async () => {});
    await submitForm();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(polls).toBe(2);
    expect(screen.getByText(/Extracting the voice/)).toBeTruthy();
    const statusCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/voice/status/voice-1")
    );
    expect(statusCalls).toHaveLength(2);
  });

  it("reports a failing status request instead of waiting forever", async () => {
    mockApi({
      "GET /api/voice/status/voice-1": () => new Response("boom", { status: 500 }),
    });

    render(<CreateVoiceFromTrackDialog isOpen onClose={vi.fn()} track={track} />);
    await act(async () => {});
    await submitForm();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(screen.getByText("Could not check the voice status")).toBeTruthy();
    expect(screen.queryByText(/Extracting the voice/)).toBeNull();
  });
});
