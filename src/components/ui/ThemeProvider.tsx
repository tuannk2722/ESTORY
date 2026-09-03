"use client";

import React, { createContext, useContext, useEffect, useReducer } from "react";
import { ReaderSettings } from "@/types/settings";
import { DEFAULT_READER_SETTINGS, settingsStore } from "@/lib/settingsStore";

// State & Action types
interface SettingsState {
  settings: ReaderSettings;
  isMounted: boolean;
}

type SettingsAction =
  | { type: "INIT"; payload: ReaderSettings }
  | { type: "SET_SETTINGS"; payload: ReaderSettings }
  | { type: "SYNC_REDUCED_MOTION"; payload: boolean };

// Reducer
function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case "INIT":
      return { settings: action.payload, isMounted: true };

    case "SET_SETTINGS":
      return { ...state, settings: action.payload };

    case "SYNC_REDUCED_MOTION":
      return {
        ...state,
        settings: { ...state.settings, reduced_motion: action.payload },
      };

    default:
      return state;
  }
}

// Context
interface ReaderSettingsContextType {
  settings: ReaderSettings;
  updateSettings: (newSettings: Partial<ReaderSettings>) => void;
  setTheme: (theme: "dark" | "light" | "sepia") => void;
  isMounted: boolean;
}

const ReaderSettingsContext = createContext<ReaderSettingsContextType>({
  settings: DEFAULT_READER_SETTINGS,
  updateSettings: () => { },
  setTheme: () => { },
  isMounted: false,
});

// Provider
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(settingsReducer, {
    settings: DEFAULT_READER_SETTINGS,
    isMounted: false,
  });

  useEffect(() => {
    // 1. Đọc settings từ localStorage
    const saved = settingsStore.getSettings();

    // 2. Tự động đồng bộ reduced_motion với prefers-reduced-motion nếu chưa có user override
    const reducedMotionOverride = settingsStore.getReducedMotionOverride();
    const initialReducedMotion =
      reducedMotionOverride ??
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const initialSettings: ReaderSettings = {
      ...saved,
      reduced_motion: initialReducedMotion ?? false,
    };

    // 3. Gán data-theme lên <html>
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", initialSettings.theme || "dark");
      document.documentElement.setAttribute("data-story-font", initialSettings.font_family || "cormorant");
    }

    dispatch({ type: "INIT", payload: initialSettings });
  }, []);

  useEffect(() => {
    if (!state.isMounted || settingsStore.getReducedMotionOverride() !== null) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => {
      dispatch({ type: "SYNC_REDUCED_MOTION", payload: event.matches });
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [state.isMounted]);

  // Cập nhật data-theme trên <html> mỗi khi theme thay đổi
  useEffect(() => {
    if (state.isMounted && typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", state.settings.theme || "dark");
    }
  }, [state.settings.theme, state.isMounted]);

  useEffect(() => {
    if (state.isMounted && typeof document !== "undefined") {
      document.documentElement.setAttribute(
        "data-story-font",
        state.settings.font_family || "cormorant"
      );
    }
  }, [state.settings.font_family, state.isMounted]);

  const updateSettings = (newSettings: Partial<ReaderSettings>) => {
    const updated = settingsStore.saveSettings(newSettings);
    dispatch({ type: "SET_SETTINGS", payload: updated });
  };

  const setTheme = (theme: "dark" | "light" | "sepia") => {
    const updated = settingsStore.saveSettings({ theme });
    dispatch({ type: "SET_SETTINGS", payload: updated });
  };

  return (
    <ReaderSettingsContext.Provider
      value={{ settings: state.settings, updateSettings, setTheme, isMounted: state.isMounted }}
    >
      {children}
    </ReaderSettingsContext.Provider>
  );
}

export function useReaderSettings() {
  return useContext(ReaderSettingsContext);
}
