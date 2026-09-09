import type { ReaderSettings } from "@/types/settings";
import type { ReaderOperation } from "./schema";

// Preserve the existing Reader defaults; DB defaults must not initialize clients.
export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  effects_enabled: true,
  effects_by_category: { visual: true, audio: true, motion: true, transition: true },
  intensity_multiplier: 0.8, reduced_motion: false,
  font_size: "lg", font_family: "cormorant", theme: "dark",
};
export function mergeSettings(current: ReaderSettings, patch: Extract<ReaderOperation, { kind: "settings" }>["patch"]): ReaderSettings {
  return { ...current, ...patch, effects_by_category: { ...current.effects_by_category, ...patch.effects_by_category } };
}
