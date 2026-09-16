"use client";

import { Pause, Play, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { EFFECT_REGISTRY } from "@/components/effects/EffectRegistry";
import { useReaderSettings } from "@/components/ui/ThemeProvider";
import type { ManagedEffectDefinition } from "@/types/effect-admin";
import type { EffectConfig } from "@/types/story";

export default function EffectPreview({ effect }: { effect: ManagedEffectDefinition }) {
  const [playing, setPlaying] = useState(false);
  const { settings, isMounted } = useReaderSettings();
  const prefersReducedMotion = !isMounted || Boolean(settings.reduced_motion);
  const Component = EFFECT_REGISTRY[effect.id];
  const previewId = `effect-admin-preview-${effect.id}`;
  const config = useMemo<EffectConfig>(() => ({
    id: previewId,
    type: effect.id,
    category: effect.category,
    intensity: effect.defaults.intensity,
    duration_ms: effect.defaults.duration_ms,
    delay_ms: effect.defaults.delay_ms,
    loop: effect.defaults.loop,
    ...(effect.category === "audio" ? { audio_src: "/audio/gentle_rain_falling.mp3" } : {}),
  }), [effect, previewId]);

  const staticFallback = prefersReducedMotion && effect.category !== "audio";

  return (
    <section aria-labelledby="effect-preview-heading" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-muted)]/35 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="effect-preview-heading" className="text-sm font-bold">Xem trước renderer</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--color-muted-foreground)]">
            {prefersReducedMotion
              ? "Thiết bị đang ưu tiên giảm chuyển động. Hiệu ứng chuyển động dùng khung tĩnh."
              : "Renderer thật chạy trong vùng cô lập bên dưới."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPlaying((current) => !current)}
          aria-pressed={playing}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
        >
          {playing ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
          {playing ? "Dừng" : "Preview"}
        </button>
      </div>

      <div
        className="effect-modal-preview-portal preview-container relative mt-3 h-48 transform-gpu overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_top,#1e293b,#05070f_72%)] text-[#F8FAFC] isolate"
        aria-label={`Vùng xem trước hiệu ứng ${effect.label}`}
      >
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <p
            className="story-block active relative z-10 max-w-sm text-center font-story text-lg leading-8"
            data-has-effect={previewId}
          >
            Trong khoảnh khắc ấy, câu chuyện bỗng chuyển mình dưới một lớp không khí hoàn toàn khác.
          </p>
        </div>

        {playing && !staticFallback && Component ? (
          <Component
            key={`${effect.id}-${playing}`}
            config={config}
            isActive
            intensityMultiplier={0.75}
            reducedMotion={prefersReducedMotion}
          />
        ) : null}

        {playing && (staticFallback || !Component) ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/25 p-5 text-center">
            <div className="rounded-2xl border border-white/15 bg-black/55 px-4 py-3 shadow-lg">
              <Sparkles aria-hidden="true" className="mx-auto h-5 w-5 text-amber-300" />
              <p className="mt-2 text-sm font-semibold">
                {staticFallback ? "Khung tĩnh — giảm chuyển động đang bật" : "Hiệu ứng này không có lớp hình ảnh."}
              </p>
            </div>
          </div>
        ) : null}

        {!playing ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20">
            <p className="rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-xs font-semibold">Đã dừng</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
