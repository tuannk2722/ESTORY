// components/scenes/SceneLayer.tsx
// Phase 2: Render tầng bối cảnh (Scene), tách biệt hoàn toàn với /components/effects (docs/08-effects-and-scenes.md)
"use client";

import React from "react";
import { Scene } from "@/types/scene";

export interface SceneLayerProps {
  scene?: Scene;
  children?: React.ReactNode;
}

/**
 * Wrapper nhận Scene đang active và render background/palette/layout, crossfade khi chuyển Scene
 */
export default function SceneLayer({ children }: SceneLayerProps) {
  return <div className="scene-layer relative w-full min-h-screen">{children}</div>;
}
