// components/effects/visual/Typewriter.tsx
// Phase 2: Hiệu ứng Đánh Máy (Typewriter) — Tia nhấp nháy con trỏ và hiệu ứng chữ máy chữ cổ điển
"use client";

import React from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function Typewriter({
  config,
  isActive,
}: EffectComponentProps) {
  if (!isActive) return null;

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="typewriter"
      className="typewriter-effect-layer fixed bottom-8 right-8 pointer-events-none z-20 flex items-center gap-2 bg-card/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border shadow-lg"
      aria-hidden="true"
    >
      <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
      <span className="text-xs font-mono text-muted-foreground">Typewriter active</span>
      <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-0.5" />
    </div>
  );
}
