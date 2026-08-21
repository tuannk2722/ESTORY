// components/effects/EffectLayer.tsx
"use client";

import React from "react";
import { EffectConfig } from "@/types/story";

export interface EffectLayerProps {
  effects?: EffectConfig[];
  children?: React.ReactNode;
}

/**
 * Wrapper component nhận EffectConfig[] và render đúng effect component từ EffectRegistry
 */
export default function EffectLayer({ children }: EffectLayerProps) {
  return <div className="effect-layer relative w-full h-full">{children}</div>;
}
