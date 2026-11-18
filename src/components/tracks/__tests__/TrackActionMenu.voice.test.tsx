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

type MenuProps = ComponentProps<typeof TrackActionMenu>;

function renderMenu(props: Partial<MenuProps> = {}) {
  return render(<TrackActionMenu {...(props as MenuProps)} />);
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTitle("Track actions"));
}

describe("TrackActionMenu — create voice from track", () => {
  it("hides the entry when the track cannot be cloned", async () => {
    const user = userEvent.setup();
    renderMenu({});
    await openMenu(user);

    expect(screen.queryByText("Create Voice from This Track")).toBeNull();
  });

  it("invokes the handler instead of acting on its own", async () => {
    const user = userEvent.setup();
    const onCreateVoiceFromTrack = vi.fn();
    renderMenu({ onCreateVoiceFromTrack });
    await openMenu(user);

    await user.click(screen.getByText("Create Voice from This Track"));
    expect(onCreateVoiceFromTrack).toHaveBeenCalledTimes(1);
  });
});
