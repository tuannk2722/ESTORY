"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/** Hydration-safe client readiness without a setState-on-mount effect. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
