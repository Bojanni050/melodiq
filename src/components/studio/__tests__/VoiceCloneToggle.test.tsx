import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import VoiceCloneToggle from "@/components/studio/VoiceCloneToggle";
import { useStudioStore } from "@/lib/store";

const baritone = {
  id: "voice-1",
  status: "completed",
  personaId: "persona-a",
  name: "Night Baritone",
  isSelected: true,
  error: null,
  createdAt: "2026-11-10T10:00:00.000Z",
};

const unnamed = {
  id: "voice-2",
  status: "completed",
  personaId: "persona-b",
  name: null,
  isSelected: false,
  error: null,
  createdAt: "2026-11-18T10:00:00.000Z",
};

/** GET returns the list newest-first, like the API's ORDER BY created_at DESC. */
function mockVoicesApi(voices: unknown[], selectResponse?: unknown[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/voice" && !init?.method) {
      return new Response(JSON.stringify({ voices }), { status: 200 });
    }
    if (url === "/api/voice/select" && init?.method === "POST") {
      return new Response(JSON.stringify({ voices: selectResponse ?? voices }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("VoiceCloneToggle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useStudioStore.setState({ usePersonaVoice: false });
  });

  it("shows the explicitly selected voice, not just the newest one", async () => {
    mockVoicesApi([unnamed, baritone]);
    useStudioStore.setState({ usePersonaVoice: true });

    render(<VoiceCloneToggle />);
    await act(async () => {});

    // voice-2 is newer, but voice-1 carries the selection flag: the header
    // paragraph shows the selection and the picker is parked on it.
    expect(screen.getByText("Night Baritone", { selector: "p" })).toBeTruthy();
    expect((screen.getByLabelText("Voice to use") as HTMLSelectElement).value).toBe("voice-1");
    expect(screen.getByLabelText("Rename voice")).toBeTruthy();
  });

  it("picks between multiple finished voices and switches after /api/voice/select", async () => {
    const afterSelect = [
      { ...unnamed, isSelected: true },
      { ...baritone, isSelected: false },
    ];
    const fetchMock = mockVoicesApi([unnamed, baritone], afterSelect);
    useStudioStore.setState({ usePersonaVoice: true });

    render(<VoiceCloneToggle />);
    await act(async () => {});

    const picker = screen.getByLabelText("Voice to use") as HTMLSelectElement;
    expect(picker.value).toBe("voice-1");
    // Two saved voices plus the "No saved voice" entry.
    expect(picker.options.length).toBe(3);
    expect(screen.getByText(/Unnamed voice/)).toBeTruthy();

    await act(async () => {
      fireEvent.change(picker, { target: { value: "voice-2" } });
    });

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post).toBeTruthy();
    expect(JSON.parse(String(post![1]!.body))).toEqual({ voiceId: "voice-2" });

    // The refreshed list flips the header to the newly selected, unnamed voice.
    expect(screen.getByText("My cloned voice", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("Name it")).toBeTruthy();
    expect((picker as HTMLSelectElement).value).toBe("voice-2");
    expect(useStudioStore.getState().usePersonaVoice).toBe(true);
  });

  it("offers a single finished voice plus the no-voice option", async () => {
    mockVoicesApi([baritone]);

    render(<VoiceCloneToggle />);
    await act(async () => {});

    expect(screen.getByText("Night Baritone", { selector: "p" })).toBeTruthy();
    const picker = screen.getByLabelText("Voice to use") as HTMLSelectElement;
    expect(picker.options.length).toBe(2);
    expect(picker.options[0].textContent).toBe("No saved voice");
  });

  it("choosing no saved voice turns the persona off without a request", async () => {
    const fetchMock = mockVoicesApi([baritone]);
    useStudioStore.setState({ usePersonaVoice: true });

    render(<VoiceCloneToggle />);
    await act(async () => {});

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Voice to use"), { target: { value: "" } });
    });

    expect(useStudioStore.getState().usePersonaVoice).toBe(false);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });
});
