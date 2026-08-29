import type { AlignmentEngine } from "../engine";
import { quicklrcEngine } from "./quicklrc";
import { elevenlabsEngine } from "./elevenlabs";

const ENGINES: Record<string, AlignmentEngine> = {
  quicklrc: quicklrcEngine,
  elevenlabs: elevenlabsEngine,
};

export function getEngine(name = "elevenlabs"): AlignmentEngine {
  const engine = ENGINES[name];
  if (!engine) {
    throw new Error(`Unknown alignment engine: ${name}`);
  }
  return engine;
}
