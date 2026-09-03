"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { Howl } from "howler";

export interface SceneAmbientAudioProps {
  audioSrc?: string;
  volume?: number;
  isActive?: boolean;
  isPaused?: boolean;
  loop?: boolean;
  durationMs?: number;
}

const CROSSFADE_MS = 800;

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
  const retiredSoundsRef = useRef(new Set<Howl>());
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldPlayRef = useRef(false);

  useEffect(() => {
    shouldPlayRef.current = Boolean(audioSrc && isActive && !isPaused && volume > 0);
  }, [audioSrc, isActive, isPaused, volume]);

  useEffect(() => {
    const clearTrackedTimer = (
      timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
    ) => {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current);
      timersRef.current.delete(timerRef.current);
      timerRef.current = null;
    };

    const schedule = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        callback();
      }, delay);
      timersRef.current.add(timer);
      return timer;
    };

    const retire = (sound: Howl) => {
      retiredSoundsRef.current.add(sound);
      sound.fade(sound.volume(), 0, CROSSFADE_MS);
      schedule(() => {
        sound.stop();
        sound.unload();
        retiredSoundsRef.current.delete(sound);
      }, CROSSFADE_MS);
    };

    clearTrackedTimer(actionTimerRef);
    clearTrackedTimer(durationTimerRef);

    if (!audioSrc || !isActive || isPaused) {
      const currentSound = soundRef.current;
      if (currentSound?.playing()) {
        currentSound.fade(currentSound.volume(), 0, CROSSFADE_MS);
        actionTimerRef.current = schedule(() => {
          currentSound.pause();
          actionTimerRef.current = null;
        }, CROSSFADE_MS);
      }
      return;
    }

    if (currentSrcRef.current !== audioSrc || !soundRef.current) {
      if (soundRef.current) retire(soundRef.current);

      const nextSound = new Howl({
        src: [audioSrc],
        html5: true,
        loop,
        volume: 0,
        onloaderror: (_id, error) => {
          console.warn(`[SceneAmbientAudio] Cannot load ${audioSrc}`, error);
        },
        onplayerror: (_id, error) => {
          console.warn("[SceneAmbientAudio] Playback was blocked", error);
          nextSound.once("unlock", () => {
            if (
              shouldPlayRef.current &&
              soundRef.current === nextSound &&
              !nextSound.playing()
            ) {
              nextSound.play();
            }
          });
        },
      });

      soundRef.current = nextSound;
      currentSrcRef.current = audioSrc;
      nextSound.play();
      nextSound.fade(0, volume, CROSSFADE_MS);
    } else {
      const currentSound = soundRef.current;
      currentSound.loop(loop);
      if (!currentSound.playing()) {
        currentSound.volume(0);
        currentSound.play();
        currentSound.fade(0, volume, CROSSFADE_MS);
      } else {
        currentSound.fade(currentSound.volume(), volume, 300);
      }
    }

    if (!loop && durationMs && durationMs > 0) {
      const stopAfterMs = Math.max(1, Number(durationMs));
      durationTimerRef.current = schedule(() => {
        const currentSound = soundRef.current;
        if (!currentSound?.playing()) return;
        currentSound.fade(currentSound.volume(), 0, CROSSFADE_MS);
        actionTimerRef.current = schedule(() => {
          currentSound.stop();
          actionTimerRef.current = null;
        }, CROSSFADE_MS);
        durationTimerRef.current = null;
      }, stopAfterMs);
    }
  }, [audioSrc, durationMs, isActive, isPaused, loop, volume]);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
      soundRef.current?.stop();
      soundRef.current?.unload();
      retiredSoundsRef.current.forEach((sound) => {
        sound.stop();
        sound.unload();
      });
      retiredSoundsRef.current.clear();
      soundRef.current = null;
      currentSrcRef.current = null;
    },
    []
  );

  return null;
}
