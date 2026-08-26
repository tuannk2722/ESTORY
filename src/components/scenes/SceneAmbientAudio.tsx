// components/scenes/SceneAmbientAudio.tsx
// Phase 2: Wrap Howler.js cho ambient_audio_src (loop nền, tách biệt khỏi AudioEffectPlayer)
"use client";

import { useEffect, useRef } from "react";
import { Howl } from "howler";

export interface SceneAmbientAudioProps {
  audioSrc?: string;
  volume?: number;
  isActive?: boolean;
  isPaused?: boolean;
  loop?: boolean;
  durationMs?: number;
}

export default function SceneAmbientAudio({
  audioSrc,
  volume = 0.5,
  isActive = true,
  isPaused = false,
  loop = true,
  durationMs,
}: SceneAmbientAudioProps) {
  const soundRef = useRef<Howl | null>(null);
  const currentSrcRef = useRef<string | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (durationTimerRef.current) {
      clearTimeout(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    // Nếu không có audioSrc hoặc không active / đang bị pause
    if (!audioSrc || !isActive || isPaused) {
      if (soundRef.current && soundRef.current.playing()) {
        const sound = soundRef.current;
        sound.fade(sound.volume(), 0, 800);
        const timeout = setTimeout(() => {
          sound.pause();
        }, 800);
        return () => clearTimeout(timeout);
      }
      return;
    }

    // Nếu audioSrc thay đổi hoặc sound chưa khởi tạo
    if (currentSrcRef.current !== audioSrc || !soundRef.current) {
      // Dọn dẹp sound cũ với crossfade 1400ms
      if (soundRef.current) {
        const oldSound = soundRef.current;
        oldSound.fade(oldSound.volume(), 0, 1400);
        setTimeout(() => {
          oldSound.stop();
          oldSound.unload();
        }, 1400);
      }

      currentSrcRef.current = audioSrc;
      const newSound = new Howl({
        src: [audioSrc],
        html5: true,
        loop: !!loop,
        volume: 0,
        onloaderror: (_id, err) => {
          console.warn(`[SceneAmbientAudio] Error loading audio: ${audioSrc}`, err);
        },
        onplayerror: (_id, err) => {
          console.warn(`[SceneAmbientAudio] Autoplay blocked or play error:`, err);
        },
      });

      soundRef.current = newSound;

      try {
        newSound.play();
        newSound.fade(0, volume, 1400);
      } catch (err) {
        console.warn("[SceneAmbientAudio] Failed to start ambient audio:", err);
      }
    } else if (soundRef.current) {
      // Đang dùng sound hiện tại, cập nhật volume hoặc resume nếu đang paused
      const sound = soundRef.current;
      sound.loop(!!loop);
      if (!sound.playing()) {
        try {
          sound.play();
          sound.fade(0, volume, 1400);
        } catch {
          // Ignore autoplay restriction
        }
      } else {
        sound.fade(sound.volume(), volume, 600);
      }
    }

    // Xử lý tự tắt sau durationMs nếu loop === false
    if (!loop && durationMs && durationMs > 0) {
      durationTimerRef.current = setTimeout(() => {
        if (soundRef.current && soundRef.current.playing()) {
          const sound = soundRef.current;
          sound.fade(sound.volume(), 0, 1000);
          setTimeout(() => {
            sound.stop();
          }, 1000);
        }
      }, durationMs);
    }

    return () => {
      if (durationTimerRef.current) {
        clearTimeout(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [audioSrc, volume, isActive, isPaused, loop, durationMs]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        const sound = soundRef.current;
        sound.fade(sound.volume(), 0, 600);
        setTimeout(() => {
          sound.stop();
          sound.unload();
        }, 600);
        soundRef.current = null;
        currentSrcRef.current = null;
      }
    };
  }, []);

  return null;
}

