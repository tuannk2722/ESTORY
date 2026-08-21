// components/effects/visual/ScreenShake.tsx
"use client";

import React from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function ScreenShake({ config, isActive }: EffectComponentProps) {
  if (!isActive) return null;
  return <div data-effect-id={config.id} className="pointer-events-none fixed inset-0 z-30" />;
}
