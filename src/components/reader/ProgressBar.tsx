"use client";

import React, { useEffect, useRef } from "react";
import { calculateScrollProgress } from "@/lib/reader/readerMetrics";

export default function ProgressBar() {
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrame = 0;

    const updateProgress = () => {
      animationFrame = 0;
      const progress = calculateScrollProgress(
        window.scrollY || document.documentElement.scrollTop,
        document.documentElement.scrollHeight,
        window.innerHeight
      );
      fillRef.current?.style.setProperty("transform", `scaleX(${progress})`);
      trackRef.current?.setAttribute(
        "aria-valuenow",
        String(Math.round(progress * 100))
      );
    };

    const scheduleUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateProgress);
    };

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(document.documentElement);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    scheduleUpdate();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div
      ref={trackRef}
      className="progress-bar-track"
      role="progressbar"
      aria-label="Tiến trình đọc chương"
      aria-valuenow={0}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div ref={fillRef} className="progress-bar-fill" aria-hidden="true" />
    </div>
  );
}
