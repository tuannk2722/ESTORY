// components/scenes/SceneBackground.tsx
// Phase 2: Render BackgroundAsset (image/gradient/particle_composition/video); nếu motion: "looping" và reduced_motion bật -> render poster_frame tĩnh
"use client";

import React from "react";
import { BackgroundAsset } from "@/types/scene";

export interface SceneBackgroundProps {
  asset?: BackgroundAsset;
  reducedMotion?: boolean;
}

export default function SceneBackground({ asset, reducedMotion = false }: SceneBackgroundProps) {
  if (!asset) return null;
  // TODO: Phase 2 render video loop / particle / gradient / image with reduced motion fallback
  return <div data-background-id={asset.id} data-reduced-motion={reducedMotion} className="scene-background fixed inset-0 -z-10" />;
}
