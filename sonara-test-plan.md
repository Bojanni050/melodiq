Je gaat tests toevoegen aan het Sonara AI Music Studio project (Next.js 16 + TypeScript 6 + React 19 + Zustand + Drizzle).

## Setup

Installeer test dependencies:
bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

Voeg aan `package.json` toe:
json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}

Maak `vitest.config.ts`:
ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});

Maak `src/test/setup.ts`:
ts
import "@testing-library/jest-dom";

## Tests om te schrijven (in volgorde van prioriteit)

### 1. Utils — `src/lib/__tests__/providers/poyo.test.ts`

Test de provider helper functies die geen API calls doen:

typescript
import { describe, it, expect } from "vitest";

// Test normalizePoYoModel — edge cases: undefined, lowercase, dots
// Test inferVariantKey — verschillende response formaten
// Test getPoYoStatusValue — status parsing
// Test extractPoYoVariants — 6+ response structuren, grouped varianten, fallback URLs
// Test getPoYoCredits — credits omrekening (decimalen * 100)

**Waarom eerst:** Dit is de meest complexe provider, en `extractPoYoVariants` heeft 6+ response structuren. Elk klein foutje kan tracks "kwijtraken". Tests vangen dat.

### 2. Utils — `src/lib/__tests__/auth.test.ts`

Test JWT auth zonder database:

typescript
import { describe, it, expect, vi } from "vitest";

// Mock process.env.JWT_SECRET
// Test generateToken returns een string
// Test verifyToken met geldige token
// Test verifyToken met ongeldige/verlopen token
// Test dat throwt als JWT_SECRET niet gezet is

**Waarom:** Auth is kritiek. Zonder test kun je per ongeluk een auth-bypass introduceren bij refactoring.

### 3. Store — `src/lib/__tests__/workspace-store.test.ts`

Test de Zustand workspace store (geen API calls, pure state):

typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useWorkspaceStore } from "../store";

describe("WorkspaceStore", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaces: [/ default workspace /],
      selectedWorkspaceId: null,
    });
  });

  // Test createWorkspace — maakt workspace met unieke ID
  // Test moveTrackToWorkspace — verplaatst track, verwijdert uit andere
  // Test moveTrackToWorkspace — duplicate check (niets doen)
  // Test deleteWorkspace — kan default niet verwijderen
  // Test setSelectedWorkspaceId — werkt met null
  // Test syncTracksToDefaultWorkspace — cleanup van verwijderde tracks
});

**Waarom:** Zuivere state logic, makkelijk te testen, en de workspace navigatie is het meest fragile op mobiel.

### 4. Store — `src/lib/__tests__/player-store.test.ts`

typescript
import { describe, it, expect } from "vitest";
import { usePlayerStore } from "../store";

// Test setCurrentTrack zet isPlaying op true
// Test setCurrentTrack(null) zet isPlaying op false
// Test enqueueTrack voegt toe aan queue
// Test playNext speelt volgende track
// Test history max 50 entries

### 5. Component snapshot tests (optioneel, later)

typescript
// Test TrackList rendering met 0 tracks (lege state)
// Test TrackList rendering met generating tracks (loading state)
// Test CollapsibleSidebar open/dicht togglen
// Test Player knoppen disabled zonder track (1/2)

### 6. Integratie — `src/app/page.test.tsx`

Smoke test: render de homepagina en check of de sidebar en track list rendern. Mock de fetch calls en de Zustand stores.

## Test patterns om te volgen

✅ **Arrange-Act-Assert:** Zet state klaar → voer actie uit → check resultaat
✅ **Beschrijvende namen:** `"should not delete default workspace"` ipv `"test delete"`
✅ **Edge cases:** lege arrays, null values, undefined
✅ **Isolement:** `beforeEach` reset state
✅ **Geen netwerk:** Mock alle fetch/API calls met `vi.fn().mockResolvedValue()`
✅ **Geen timers:** Mock `setInterval` met `vi.useFakeTimers()`

## Voorbeeld

typescript
// src/lib/__tests__/workspace-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useWorkspaceStore, DEFAULT_WORKSPACE_ID } from "../store";

describe("WorkspaceStore", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaces: [{ id: DEFAULT_WORKSPACE_ID, name: "Default", trackIds: [], isDefault: true }],
      selectedWorkspaceId: null,
    });
  });

  it("should not delete the default workspace", () => {
    useWorkspaceStore.getState().deleteWorkspace(DEFAULT_WORKSPACE_ID);
    const workspaces = useWorkspaceStore.getState().workspaces;
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].id).toBe(DEFAULT_WORKSPACE_ID);
  });

  it("should move a track between workspaces and remove from source", () => {
    const workspace2 = useWorkspaceStore.getState().createWorkspace("My Workspace");
    useWorkspaceStore.getState().moveTrackToWorkspace(DEFAULT_WORKSPACE_ID, "track-1");
    useWorkspaceStore.getState().moveTrackToWorkspace(workspace2, "track-1");

    const defaultWs = useWorkspaceStore.getState().workspaces.find(w => w.id === DEFAULT_WORKSPACE_ID);
    const targetWs = useWorkspaceStore.getState().workspaces.find(w => w.id === workspace2);

    expect(defaultWs?.trackIds).not.toContain("track-1");
    expect(targetWs?.trackIds).toContain("track-1");
  });
});

## Draai de tests

bash
npm test              # eenmalig
npm run test:watch    # watch mode


---