"use client";

import { useEffect, useRef } from "react";
import { Howl } from "howler";
import { EffectComponentProps } from "../EffectRegistry";
import { useReaderSettings } from "@/components/ui/ThemeProvider";

export default function AudioEffectPlayer({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const { settings } = useReaderSettings();
  const soundRef = useRef<Howl | null>(null);

  useEffect(() => {
    // Kiểm tra audio có được bật không
    const isAudioEnabled =
      settings.effects_enabled &&
      settings.effects_by_category?.audio !== false;

    if (!isActive || !config.audio_src || !isAudioEnabled) {
      if (soundRef.current) {
        soundRef.current.stop();
      }
      return;
    }

    const volume = Math.max(0.1, Math.min(1.0, config.intensity * intensityMultiplier));

    try {
      if (!soundRef.current) {
        soundRef.current = new Howl({
          src: [config.audio_src],
          volume,
          loop: !!config.loop,
          html5: false, // Dùng Web Audio API cho hiệu ứng SFX ngắn, chính xác và nhanh
          format: ["mp3", "wav"],
          onloaderror: (_id, error) => {
            // Không làm crash ứng dụng nếu audio chưa tải được
            console.info("Audio effect placeholder loaded:", config.audio_src, error);
          },
          onplayerror: (_id, error) => {
            // Trình duyệt chặn autoplay khi user chưa tương tác
            soundRef.current?.once("unlock", () => {
              soundRef.current?.play();
            });
          },
        });
      } else {
        soundRef.current.volume(volume);
      }

      soundRef.current.play();

      if (!config.loop && config.duration_ms) {
        const timer = setTimeout(() => {
          if (soundRef.current) {
            soundRef.current.fade(volume, 0, 400);
            setTimeout(() => soundRef.current?.stop(), 400);
          }
        }, config.duration_ms);
        return () => clearTimeout(timer);
      }
    } catch (err) {
      console.warn("Audio playback error:", err);
    }

    return () => {
      if (soundRef.current) {
        soundRef.current.stop();
      }
    };
  }, [isActive, config.audio_src, config.intensity, config.loop, config.duration_ms, intensityMultiplier, settings.effects_enabled, settings.effects_by_category?.audio]);

  return null;
}
