// components/effects/visual/TextShake.tsx
"use client";

import React from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function TextShake({ config, isActive }: EffectComponentProps) {
  if (!isActive) return null;
  return <span data-effect-id={config.id} className="inline-block" />;
}
