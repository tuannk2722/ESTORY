"use client";

import React, { createContext, useContext, useEffect, useLayoutEffect } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { toast } from "sonner";
import type { ReaderSettings } from "@/types/settings";
import { DEFAULT_READER_SETTINGS, settingsStore } from "@/lib/settingsStore";
import { GUEST_KEYS } from "@/lib/reader-state/local-store";
import { accountCacheKey } from "@/lib/reader-state/sync-store";
import { useSettingsSync } from "@/hooks/useSettingsSync";

interface ReaderSettingsContextType {
  settings: ReaderSettings;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
  setTheme: (theme: "dark" | "light" | "sepia") => void;
  isMounted: boolean;
}
const ReaderSettingsContext = createContext<ReaderSettingsContextType>({
  settings: DEFAULT_READER_SETTINGS, updateSettings: () => {}, setTheme: () => {}, isMounted: false,
});

function SettingsSession({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const identity = session.data?.user.id ?? (session.status === "loading" ? undefined : null);
  const sync = useSettingsSync();
  // Reset account data before paint, including subscriptions outside this context.
  useLayoutEffect(() => { void settingsStore.connect(identity); }, [identity]);
  const isMounted = sync.userId === identity && sync.ready;
  const settings = isMounted ? settingsStore.getSettings() : DEFAULT_READER_SETTINGS;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
    document.documentElement.setAttribute("data-story-font", settings.font_family);
  }, [isMounted, settings.theme, settings.font_family]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMedia = () => settingsStore.notifyGuest();
    const onStorage = (event: StorageEvent) => {
      const userId = settingsStore.getStatus().userId;
      if (userId && (event.key === null || event.key === accountCacheKey(userId))) void settingsStore.refresh();
      else if (userId === null && (event.key === null || Object.values(GUEST_KEYS).some((key) => key === event.key))) settingsStore.notifyGuest();
    };
    const refresh = () => { void settingsStore.refresh(); };
    media.addEventListener("change", onMedia);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 60_000);
    return () => {
      media.removeEventListener("change", onMedia);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.clearInterval(poll);
    };
  }, []);

  const { update } = session;
  useEffect(() => {
    const refreshSession = () => { void update().then((value) => {
      // Auth.js update() retains the old context when the server returns null.
      // Reload an expired/revoked session to establish guest state safely.
      if (value === null) window.location.reload();
    }); };
    window.addEventListener("reader-session-changed", refreshSession);
    return () => window.removeEventListener("reader-session-changed", refreshSession);
  }, [update]);
  useEffect(() => {
    if (!sync.error) return;
    toast.error(sync.error, { id: "reader-sync", duration: 10_000, action: {
      label: "Thử lại", onClick: () => { void update().then(() => settingsStore.refresh()); },
    } });
  }, [sync.error, update]);

  return (
    <ReaderSettingsContext.Provider value={{ settings, isMounted,
      updateSettings: (patch) => { settingsStore.saveSettings(patch); },
      setTheme: (theme) => { settingsStore.saveSettings({ theme }); },
    }}>
      {children}
    </ReaderSettingsContext.Provider>
  );
}
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider refetchOnWindowFocus refetchInterval={60}><SettingsSession>{children}</SettingsSession></SessionProvider>;
}
export function useReaderSettings() { return useContext(ReaderSettingsContext); }
