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

const cloning = {
  id: "voice-3",
  status: "pending",
  personaId: null,
  name: "Zurii",
  isSelected: false,
  error: null,
  createdAt: "2026-11-19T10:00:00.000Z",
};

/** GET returns the list newest-first, like the API's ORDER BY created_at DESC. */
function mockVoicesApi(voices: unknown[]) {
  let current = voices;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/voice" && !init?.method) {
      return new Response(JSON.stringify({ voices: current }), { status: 200 });
    }
    if (url === "/api/voice/select" && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      current = (current as Array<{ id: string }>).map((voice) => ({
        ...voice,
        isSelected: body.voiceId === voice.id,
      }));
      return new Response(JSON.stringify({ voices: current }), { status: 200 });
    }
    if (url.startsWith("/api/voice/") && init?.method === "DELETE") {
      const id = url.split("/").pop();
      current = (current as Array<{ id: string }>).filter((voice) => voice.id !== id);
      return new Response(JSON.stringify({ deleted: true, voices: current }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("VoiceCloneToggle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useStudioStore.setState({ usePersonaVoice: false, useDnaModel: false });
  });

  it("shows the explicitly selected voice, not just the newest one", async () => {
    mockVoicesApi([unnamed, baritone]);
    useStudioStore.setState({ usePersonaVoice: true });

    render(<VoiceCloneToggle />);
    await act(async () => {});

    // voice-2 is newer, but voice-1 carries the selection flag.
    const active = screen.getByRole("radio", { name: "Night Baritone" });
    expect(active.getAttribute("aria-checked")).toBe("true");
    expect(
      screen.getByRole("radio", { name: /Unnamed voice/ }).getAttribute("aria-checked")
    ).toBe("false");
    expect(screen.getByText("Night Baritone will sing the next generation.")).toBeTruthy();
  });

  it("turns the persona on when the server reports a selected voice", async () => {
    mockVoicesApi([baritone]);
    useStudioStore.setState({ usePersonaVoice: false });

    render(<VoiceCloneToggle />);
    await act(async () => {});

    // The stored selection is the source of truth, so a fresh page (or a
    // reset store) follows it instead of showing "no voice" under a ready one.
    expect(useStudioStore.getState().usePersonaVoice).toBe(true);
  });

  it("lists a pending clone immediately but does not let it be picked", async () => {
    mockVoicesApi([cloning, baritone]);
    useStudioStore.setState({ usePersonaVoice: true });

    render(<VoiceCloneToggle />);
    await act(async () => {});

    const pending = screen.getByRole("radio", { name: "Zurii" });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Voice cloning in progress…")).toBeTruthy();
  });

  it("picks between multiple finished voices and switches after /api/voice/select", async () => {
    const fetchMock = mockVoicesApi([unnamed, baritone]);
    useStudioStore.setState({ usePersonaVoice: true });

    render(<VoiceCloneToggle />);
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: /Unnamed voice/ }));
    });

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post).toBeTruthy();
    expect(JSON.parse(String(post![1]!.body))).toEqual({ voiceId: "voice-2" });

    expect(
      screen.getByRole("radio", { name: /Unnamed voice/ }).getAttribute("aria-checked")
    ).toBe("true");
    expect(useStudioStore.getState().usePersonaVoice).toBe(true);
  });

  it("clearing the selection posts null so the server stops sending a persona", async () => {
    const fetchMock = mockVoicesApi([baritone]);
    useStudioStore.setState({ usePersonaVoice: true });

    render(<VoiceCloneToggle />);
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "No saved voice" }));
    });

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post).toBeTruthy();
    expect(JSON.parse(String(post![1]!.body))).toEqual({ voiceId: null });
    expect(useStudioStore.getState().usePersonaVoice).toBe(false);
    expect(
      screen.getByRole("radio", { name: "No saved voice" }).getAttribute("aria-checked")
    ).toBe("true");
  });

  it("deletes a voice after confirmation", async () => {
    const fetchMock = mockVoicesApi([baritone]);
    useStudioStore.setState({ usePersonaVoice: true });

    render(<VoiceCloneToggle />);
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Delete voice"));
    });
    expect(screen.getByText(/Delete "Night Baritone"\?/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    const del = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(del?.[0]).toBe("/api/voice/voice-1");
    expect(screen.queryByRole("radio", { name: "Night Baritone" })).toBeNull();
    expect(useStudioStore.getState().usePersonaVoice).toBe(false);
  });
});
