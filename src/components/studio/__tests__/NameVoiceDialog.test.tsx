import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import NameVoiceDialog from "@/components/studio/NameVoiceDialog";

/** Answers by URL so the rename PATCH and error responses each get theirs. */
function mockApi(overrides: Record<string, () => Response> = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${String(input)}`;
    const handler =
      overrides[key] ??
      (() =>
        new Response(JSON.stringify({ voice: { id: "voice-1", name: "Warm baritone" } }), {
          status: 200,
        }));
    return handler();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("NameVoiceDialog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefills the current name and PATCHes the trimmed result", async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const fetchMock = mockApi();

    render(
      <NameVoiceDialog
        isOpen
        onClose={onClose}
        voice={{ id: "voice-1", name: "Old name" }}
        onSaved={onSaved}
      />
    );

    const input = screen.getByLabelText("Voice name") as HTMLInputElement;
    expect(input.value).toBe("Old name");

    fireEvent.change(input, { target: { value: "  Warm baritone  " } });
    await act(async () => {
      fireEvent.click(screen.getByText("Save name"));
    });

    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patch).toBeTruthy();
    // The name is trimmed before it is stored, matching the API route.
    expect(JSON.parse(String(patch![1]!.body))).toEqual({ name: "Warm baritone" });
    expect(onSaved).toHaveBeenCalledWith({ id: "voice-1", name: "Warm baritone" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the save button disabled for an empty or whitespace name", () => {
    mockApi();
    render(
      <NameVoiceDialog
        isOpen
        onClose={vi.fn()}
        voice={{ id: "voice-1", name: null }}
        onSaved={vi.fn()}
      />
    );

    const input = screen.getByLabelText("Voice name") as HTMLInputElement;
    expect(input.value).toBe("");
    expect((screen.getByText("Save name") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: "   " } });
    expect((screen.getByText("Save name") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the server error and stays open when saving fails", async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    mockApi({
      "PATCH /api/voice/voice-1": () =>
        new Response(JSON.stringify({ error: "A name is required" }), { status: 400 }),
    });

    render(
      <NameVoiceDialog
        isOpen
        onClose={onClose}
        voice={{ id: "voice-1", name: "Old name" }}
        onSaved={onSaved}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Save name"));
    });

    expect(screen.getByText("A name is required")).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders nothing without a voice", () => {
    mockApi();
    render(<NameVoiceDialog isOpen onClose={vi.fn()} voice={null} onSaved={vi.fn()} />);
    expect(screen.queryByLabelText("Voice name")).toBeNull();
  });
});
