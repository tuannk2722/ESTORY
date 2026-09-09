// All settings/progress/bookmark persistence remains behind this facade.
export { DEFAULT_READER_SETTINGS } from "./reader-state/settings";
export { LocalStorageSettingsStore, type ISettingsStore } from "./reader-state/local-store";
import { SyncedSettingsStore } from "./reader-state/sync-store";
export const settingsStore = new SyncedSettingsStore();
