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
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentSrcRef = useRef<string | null>(null);

  useEffect(() => {
    // Hủy các timer dập tắt âm thanh đang chờ từ lần render trước để tránh giết nhầm âm thanh mới
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (durationTimerRef.current) {
      clearTimeout(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    const isAudioEnabled =
      settings.effects_enabled &&
      settings.effects_by_category?.audio !== false;

    if (!isActive || !config.audio_src || !isAudioEnabled) {
      if (soundRef.current && soundRef.current.playing()) {
        const sound = soundRef.current;
        sound.fade(sound.volume(), 0, 350);
        stopTimeoutRef.current = setTimeout(() => {
          sound.stop();
          stopTimeoutRef.current = null;
        }, 350);
      }
      return;
    }

    const targetVolume = Math.max(0.05, Math.min(1.0, (config.intensity ?? 0.8) * intensityMultiplier));

    try {
      // Nếu đổi file audio hoặc chưa có Howl instance
      if (currentSrcRef.current !== config.audio_src || !soundRef.current) {
        if (soundRef.current) {
          soundRef.current.stop();
          soundRef.current.unload();
        }

        currentSrcRef.current = config.audio_src;
        const newSound = new Howl({
          src: [config.audio_src],
          volume: targetVolume,
          loop: !!config.loop,
          html5: false, // Dùng Web Audio API cho hiệu ứng SFX độ trễ thấp
          format: ["mp3", "wav", "ogg"],
          onloaderror: (_id, error) => {
            console.info("Audio effect placeholder loaded:", config.audio_src, error);
          },
          onplayerror: (_id, error) => {
            newSound.once("unlock", () => {
              newSound.play();
            });
          },
        });

        soundRef.current = newSound;
        newSound.play();
      } else {
        // Đã có instance: cập nhật volume và loop
        const sound = soundRef.current;
        sound.loop(!!config.loop);
        sound.volume(targetVolume);
        if (!sound.playing()) {
          sound.play();
        }
      }

      // Xử lý tự ngắt sau duration_ms nếu loop === false và duration_ms > 0
      if (!config.loop && config.duration_ms && config.duration_ms > 0) {
        durationTimerRef.current = setTimeout(() => {
          if (soundRef.current && soundRef.current.playing()) {
            const sound = soundRef.current;
            sound.fade(sound.volume(), 0, 400);
            stopTimeoutRef.current = setTimeout(() => {
              sound.stop();
              stopTimeoutRef.current = null;
            }, 400);
          }
        }, config.duration_ms);
      }
    } catch (err) {
      console.warn("Audio playback error:", err);
    }

    return () => {
      if (durationTimerRef.current) {
        clearTimeout(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [
    isActive,
    config.audio_src,
    config.intensity,
    config.loop,
    config.duration_ms,
    intensityMultiplier,
    settings.effects_enabled,
    settings.effects_by_category?.audio,
  ]);

  // Cleanup khi component bị unmount hoàn toàn
  useEffect(() => {
    return () => {
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
      if (durationTimerRef.current) {
        clearTimeout(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      if (soundRef.current) {
        const sound = soundRef.current;
        sound.fade(sound.volume(), 0, 300);
        setTimeout(() => {
          sound.stop();
          sound.unload();
        }, 300);
        soundRef.current = null;
        currentSrcRef.current = null;
      }
    };
  }, []);

  return null;
}
