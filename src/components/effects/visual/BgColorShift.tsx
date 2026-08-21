// components/effects/visual/BgColorShift.tsx
"use client";

import React from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function BgColorShift({ config, isActive }: EffectComponentProps) {
  if (!isActive) return null;
  return <div data-effect-id={config.id} className="pointer-events-none fixed inset-0 z-10 transition-colors duration-1000" />;
}
