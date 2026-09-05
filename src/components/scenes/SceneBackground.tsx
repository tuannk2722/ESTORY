// components/scenes/SceneBackground.tsx
// Phase 2: Render BackgroundAsset (image/gradient/particle_composition/video); nếu motion: "looping" và reduced_motion bật -> render poster_frame tĩnh
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { LegacyBackgroundAsset as BackgroundAsset } from "@/types/scene-legacy";
import { isParticleCompositionKey, PARTICLE_COMPOSITION_REGISTRY } from "@/lib/scenes/particle-composition-registry";

export interface SceneBackgroundProps {
  asset?: BackgroundAsset;
  reducedMotion?: boolean;
  opacity?: number;
}

export default function SceneBackground({
  asset,
  reducedMotion = false,
  opacity = 1,
}: SceneBackgroundProps) {
  const [videoError, setVideoError] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!asset) return null;

  const shouldRenderStatic = reducedMotion && asset.motion === "looping";

  if (shouldRenderStatic) {
    return (
      <div
        data-background-id={asset.id}
        data-reduced-motion="true"
        className="scene-background absolute inset-0 overflow-hidden pointer-events-none"
        style={{ opacity }}
        aria-hidden="true"
      >
        {asset.poster_frame ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.poster_frame}
            alt=""
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background:
                asset.type === "gradient"
                  ? asset.value
                  : "radial-gradient(ellipse at center, #1b263b 0%, #0d1b2a 60%, #050b14 100%)",
            }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at center, transparent 40%, rgba(0, 0, 0, 0.4) 100%)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      data-background-id={asset.id}
      data-reduced-motion={reducedMotion}
      className="scene-background absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-700 ease-in-out"
      style={{ opacity }}
      aria-hidden="true"
    >
      {/* 1. Gradient Background */}
      {asset.type === "gradient" && (
        <motion.div
          className="absolute inset-0 w-full h-full"
          style={{ background: asset.value }}
          animate={
            !reducedMotion
              ? {
                  scale: [1, 1.04, 1],
                  opacity: [0.95, 1, 0.95],
                }
              : {}
          }
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* 2. Image Background With Cinematic Ken Burns Camera Breathing */}
      {asset.type === "image" && (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          {!imageError ? (
            <motion.img
              key={asset.value}
              src={asset.value}
              alt={asset.label}
              initial={{ scale: 1.02, opacity: 0.9 }}
              animate={
                !reducedMotion
                  ? {
                      scale: [1.02, 1.08, 1.04, 1.02],
                      x: ["0%", "-1.5%", "1%", "0%"],
                      y: ["0%", "-1%", "0.8%", "0%"],
                      opacity: 1,
                    }
                  : { scale: 1, opacity: 1 }
              }
              transition={{
                duration: 14,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-full h-full object-cover object-center"
              onError={() => setImageError(true)}
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background:
                  "radial-gradient(ellipse at center, #1b263b 0%, #0d1b2a 60%, #050b14 100%)",
              }}
            />
          )}
        </div>
      )}

      {/* 3. Video Background (Muted loop with poster frame fallback) */}
      {asset.type === "video" && (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          {videoError ? (
            asset.poster_frame ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.poster_frame}
                alt={asset.label}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background:
                    "linear-gradient(180deg, #050b14 0%, #0f172a 50%, #1e293b 100%)",
                }}
              />
            )
          ) : (
            <video
              key={asset.value}
              autoPlay
              loop
              muted
              playsInline
              poster={asset.poster_frame}
              onError={() => setVideoError(true)}
              className="w-full h-full object-cover object-center"
            >
              <source src={asset.value} type="video/mp4" />
              <source src={asset.value} type="video/webm" />
            </video>
          )}
        </div>
      )}

      {/* 4. Particle Composition Background */}
      {asset.type === "particle_composition" && (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <div
            className="w-full h-full"
            style={{
              background:
                isParticleCompositionKey(asset.value)
                  ? PARTICLE_COMPOSITION_REGISTRY[asset.value].background
                  : "radial-gradient(ellipse at center, #0f172a 0%, #020617 100%)",
            }}
          />
        </div>
      )}

      {/* Global Vignette for immersive contrast */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at center, transparent 40%, rgba(0, 0, 0, 0.4) 100%)",
        }}
      />
    </div>
  );
}

