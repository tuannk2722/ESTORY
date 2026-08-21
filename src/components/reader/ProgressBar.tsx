"use client";

import React, { useEffect, useState } from "react";

export default function ProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const calculateScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight - windowHeight;
      if (documentHeight <= 0) return setProgress(0);

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const pct = Math.min(100, Math.max(0, (scrollTop / documentHeight) * 100));
      setProgress(pct);
    };

    window.addEventListener("scroll", calculateScroll, { passive: true });
    calculateScroll();

    return () => window.removeEventListener("scroll", calculateScroll);
  }, []);

  return (
    <div className="progress-bar-track">
      <div
        className="progress-bar-fill"
        style={{ width: `${progress}%` }}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
