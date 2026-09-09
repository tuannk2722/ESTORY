"use client";
import { useSyncExternalStore } from "react";
import { settingsStore } from "@/lib/settingsStore";
import { INITIAL_SYNC_STATUS } from "@/lib/reader-state/sync-store";

export function useSettingsSync() {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.getStatus, () => INITIAL_SYNC_STATUS);
}
