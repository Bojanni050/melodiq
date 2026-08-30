import type { ComponentProps } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import TrackActionMenu from "@/components/tracks/TrackActionMenu";

// The component calls useRouter(); jsdom has no mounted Next app router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/library",
  useSearchParams: () => new URLSearchParams(),
}));

// The menu is a dropdown; every test opens it first.
async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByTitle("Track actions");
  await user.click(trigger);
}

type MenuProps = ComponentProps<typeof TrackActionMenu>;

// Every prop is optional in practice — the component renders whichever
// sections it was given handlers for — so tests pass only what they exercise.
function renderMenu(props: Partial<MenuProps> = {}) {
  return render(<TrackActionMenu {...(props as MenuProps)} />);
}

describe("TrackActionMenu — time-coded lyrics entries", () => {
  it("offers Generate, and no editor or regenerate entry, when there is no alignment yet", async () => {
    const user = userEvent.setup();
    renderMenu({ onGenerateTclClick: vi.fn() });
    await openMenu(user);

    expect(screen.getByText("Generate Time-Coded Lyrics")).toBeTruthy();
    expect(screen.queryByText("Open in Time-Coded Lyrics Editor")).toBeNull();
    expect(screen.queryByText("Regenerate Time-Coded Lyrics")).toBeNull();
  });

  it("offers the editor and regenerate, and not Generate, once an alignment exists", async () => {
    const user = userEvent.setup();
    renderMenu({ onOpenTclEditorClick: vi.fn(), onRegenerateTclClick: vi.fn() });
    await openMenu(user);

    expect(screen.getByText("Open in Time-Coded Lyrics Editor")).toBeTruthy();
    expect(screen.getByText("Regenerate Time-Coded Lyrics")).toBeTruthy();
    expect(screen.queryByText("Generate Time-Coded Lyrics")).toBeNull();
  });

  it("shows no Lyrics section at all when none of the handlers are supplied", async () => {
    const user = userEvent.setup();
    renderMenu({});
    await openMenu(user);

    expect(screen.queryByText("Lyrics")).toBeNull();
  });

  it("invokes the editor handler — the click must not itself navigate", async () => {
    const user = userEvent.setup();
    const onOpenTclEditorClick = vi.fn();
    renderMenu({ onOpenTclEditorClick });
    await openMenu(user);

    await user.click(screen.getByText("Open in Time-Coded Lyrics Editor"));
    expect(onOpenTclEditorClick).toHaveBeenCalledTimes(1);
  });

  it("invokes the regenerate handler, which opens the confirmation rather than regenerating", async () => {
    const user = userEvent.setup();
    const onRegenerateTclClick = vi.fn();
    renderMenu({ onRegenerateTclClick });
    await openMenu(user);

    await user.click(screen.getByText("Regenerate Time-Coded Lyrics"));
    expect(onRegenerateTclClick).toHaveBeenCalledTimes(1);
  });

  it("disables both generate and regenerate while a run is in flight", async () => {
    const user = userEvent.setup();
    renderMenu({
      onRegenerateTclClick: vi.fn(),
      generatingTcl: true,
    });
    await openMenu(user);

    const button = screen.getByText("Regenerating Time-Coded Lyrics...");
    expect(button.closest("button")?.disabled).toBe(true);
  });
});
