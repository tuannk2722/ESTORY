// components/effects/visual/LightningFlash.tsx
"use client";

import React from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function LightningFlash({ config, isActive }: EffectComponentProps) {
  if (!isActive) return null;
  return <div data-effect-id={config.id} className="pointer-events-none fixed inset-0 z-50 bg-white opacity-0" />;
}
