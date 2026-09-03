// src/components/editor/effects/EffectPreview.tsx
// Canonical five-second preview layer rendered above the EffectPicker modal.

"use client";

import React from "react";
import { createPortal } from "react-dom";
import type { EffectConfig } from "@/types/story";
import { EFFECT_REGISTRY } from "@/components/effects/EffectRegistry";

export interface EffectPreviewProps {
  effect: EffectConfig | null;
}

const TARGET_DEMO_EFFECTS = new Set(["text_shake", "text_grow", "screen_shake"]);

export const EffectPreview = React.memo(function EffectPreview({
  effect,
}: EffectPreviewProps) {
  if (!effect || typeof document === "undefined" || !document.body) return null;

  const Component = EFFECT_REGISTRY[effect.type];
  if (!Component) return null;

  return createPortal(
    <div className="effect-modal-preview-portal pointer-events-none fixed inset-0 z-[90] overflow-hidden">
      {TARGET_DEMO_EFFECTS.has(effect.type) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/25 px-6">
          <p
            data-has-effect={effect.id}
            className="story-block active max-w-xl text-center font-display text-3xl font-bold text-white drop-shadow-xl md:text-5xl"
          >
            Văn bản xem trước hiệu ứng
          </p>
        </div>
      )}
      <Component
        config={effect}
        isActive
        intensityMultiplier={1}
        reducedMotion={false}
      />
    </div>,
    document.body
  );
});
