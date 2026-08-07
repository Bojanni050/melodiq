import type { AlignmentEngine } from "../engine";
import { quicklrcEngine } from "./quicklrc";

const ENGINES: Record<string, AlignmentEngine> = {
  quicklrc: quicklrcEngine,
};

export function getEngine(name = "quicklrc"): AlignmentEngine {
  const engine = ENGINES[name];
  if (!engine) {
    throw new Error(`Unknown alignment engine: ${name}`);
  }
  return engine;
}
