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
  | { type: "SET_SETTINGS"; payload: Partial<ReaderSettings> }
  | { type: "SET_THEME"; payload: "dark" | "light" | "sepia" };

// Reducer
function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case "INIT":
      return { settings: action.payload, isMounted: true };

    case "SET_SETTINGS": {
      const updated = settingsStore.saveSettings(action.payload);
      return { ...state, settings: updated };
    }

    case "SET_THEME": {
      const updated = settingsStore.saveSettings({ theme: action.payload });
      return { ...state, settings: updated };
    }

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
    let initialReducedMotion = saved.reduced_motion;
    if (typeof window !== "undefined" && window.matchMedia) {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (initialReducedMotion === undefined || initialReducedMotion === false) {
        initialReducedMotion = prefersReduced;
      }
    }

    const initialSettings: ReaderSettings = {
      ...saved,
      reduced_motion: initialReducedMotion,
    };

    // 3. Gán data-theme lên <html>
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", initialSettings.theme || "dark");
    }

    dispatch({ type: "INIT", payload: initialSettings });
  }, []);

  // Cập nhật data-theme trên <html> mỗi khi theme thay đổi
  useEffect(() => {
    if (state.isMounted && typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", state.settings.theme || "dark");
    }
  }, [state.settings.theme, state.isMounted]);

  const updateSettings = (newSettings: Partial<ReaderSettings>) => {
    dispatch({ type: "SET_SETTINGS", payload: newSettings });
  };

  const setTheme = (theme: "dark" | "light" | "sepia") => {
    dispatch({ type: "SET_THEME", payload: theme });
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
