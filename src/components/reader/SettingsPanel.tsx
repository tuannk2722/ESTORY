// components/reader/SettingsPanel.tsx
"use client";

import React from "react";

export interface SettingsPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

/**
 * Bảng điều khiển tùy chỉnh trải nghiệm đọc (hiệu ứng, font size, theme, reduced motion)
 */
export default function SettingsPanel({ isOpen = false }: SettingsPanelProps) {
  if (!isOpen) return null;
  return (
    <aside className="settings-panel fixed right-0 top-0 h-full w-80 bg-background/95 backdrop-blur shadow-lg z-50 p-4">
      <h3 className="text-lg font-bold">Cài đặt đọc truyện</h3>
      {/* TODO: Phase 1 controls */}
    </aside>
  );
}
