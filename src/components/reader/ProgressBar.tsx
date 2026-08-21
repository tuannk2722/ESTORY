// components/reader/ProgressBar.tsx
"use client";

import React from "react";

export interface ProgressBarProps {
  progress?: number; // 0 - 100
}

/**
 * Thanh tiến trình hiển thị % đã cuộn trong chapter hiện tại
 */
export default function ProgressBar({ progress = 0 }: ProgressBarProps) {
  return (
    <div className="fixed top-0 left-0 w-full h-1 bg-muted z-50">
      <div
        className="h-full bg-primary transition-all duration-150"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}
