// components/effects/visual/TransitionPageTear.tsx
// Phase 2: Hiệu ứng Xé Trang / Lật Trang (Page Tear Transition)
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EffectComponentProps } from "../EffectRegistry";

export default function TransitionPageTear({
  config,
  isActive,
}: EffectComponentProps) {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          data-effect-id={config.id}
          data-effect-type="transition_page_tear"
          initial={{ clipPath: "polygon(0 0, 0 0, 0 100%, 0 100%)", opacity: 0.95 }}
          animate={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)", opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: (config.duration_ms || 1200) / 1000, ease: "easeInOut" }}
          className="page-tear-transition fixed inset-0 pointer-events-none z-40 overflow-hidden"
          aria-hidden="true"
        >
          {/* Jagged Paper Tear Shadow */}
          <div
            className="w-full h-full bg-background/90"
            style={{
              boxShadow: "inset -12px 0 24px rgba(0,0,0,0.6)",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
