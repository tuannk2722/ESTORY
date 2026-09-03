// src/components/editor/effects/EffectConfigForm.tsx
// Accessible configuration controls for one canonical EffectConfig draft.

"use client";

import React, { useId } from "react";
import type { EffectConfig } from "@/types/story";
import { Clock, Repeat, Sliders, Timer, Volume2 } from "lucide-react";
import { EFFECT_METADATA, getEffectIcon } from "@/lib/effects/effectCatalog";

export type EffectConfigUpdate = Partial<
  Pick<
    EffectConfig,
    | "intensity"
    | "duration_ms"
    | "delay_ms"
    | "loop"
    | "audio_src"
    | "audio_asset_id"
  >
>;

export interface EffectConfigFormProps {
  effect: EffectConfig;
  onChange: (update: EffectConfigUpdate) => void;
  embedded?: boolean;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

export const EffectConfigForm = React.memo(function EffectConfigForm({
  effect,
  onChange,
  embedded = false,
}: EffectConfigFormProps) {
  const intensityId = useId();
  const durationId = useId();
  const delayId = useId();
  const audioSourceId = useId();
  const isAudio = effect.type === "audio";
  const audioSrc = effect.audio_src ?? "";
  const durationValue =
    effect.duration_ms >= 200 ? Math.min(effect.duration_ms, 10000) : 2000;
  const meta = EFFECT_METADATA[effect.type];
  const Icon = getEffectIcon(effect.type, effect.category);

  return (
    <section
      className={
        embedded
          ? "space-y-4"
          : "space-y-4 rounded-xl border border-border bg-secondary/30 p-4"
      }
      aria-labelledby={embedded ? undefined : `${intensityId}-config-title`}
      aria-label={embedded ? `Tùy chỉnh ${meta.label}` : undefined}
    >
      {!embedded && <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <h3
          id={`${intensityId}-config-title`}
          className="text-sm font-semibold text-foreground"
        >
          Tùy chỉnh: {meta.label.split("(")[0].trim()}
        </h3>
      </div>}

      {isAudio && (
        <div className="space-y-2">
          <label
            htmlFor={audioSourceId}
            className="flex items-center gap-1.5 text-xs font-semibold text-foreground"
          >
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
            Nguồn âm thanh
          </label>
          <div className="flex items-stretch gap-2">
            <input
              id={audioSourceId}
              type="text"
              inputMode="url"
              value={audioSrc}
              onChange={(event) =>
                onChange({
                  audio_src: event.target.value,
                  audio_asset_id: undefined,
                })
              }
              placeholder="Chọn preset hoặc dán URL âm thanh..."
              className={`min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground ${focusRing}`}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <label
            htmlFor={intensityId}
            className="flex items-center gap-1.5 font-medium text-muted-foreground"
          >
            <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
            {isAudio ? "Âm lượng (Intensity)" : "Cường độ (Intensity)"}
          </label>
          <output htmlFor={intensityId} className="font-semibold text-accent">
            {Math.round(effect.intensity * 100)}%
          </output>
        </div>
        <input
          id={intensityId}
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={effect.intensity}
          onChange={(event) =>
            onChange({ intensity: Number.parseFloat(event.target.value) })
          }
          className={`min-h-11 w-full cursor-pointer accent-primary ${focusRing}`}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <label
            htmlFor={durationId}
            className="flex items-center gap-1.5 font-medium text-muted-foreground"
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {isAudio ? "Giới hạn phát tối đa" : "Thời lượng (Duration)"}
          </label>
          <output htmlFor={durationId} className="font-mono font-semibold text-foreground">
            {isAudio ? `${(durationValue / 1000).toFixed(1)}s` : `${durationValue}ms`}
          </output>
        </div>
        <input
          id={durationId}
          type="range"
          min={200}
          max={10000}
          step={100}
          value={durationValue}
          disabled={effect.loop}
          onChange={(event) =>
            onChange({ duration_ms: Number.parseInt(event.target.value, 10) })
          }
          className={`min-h-11 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
        />
        {effect.loop ? (
          <p className="text-[11px] text-muted-foreground">
            {isAudio
              ? "Giới hạn này không áp dụng khi âm thanh đang lặp liên tục."
              : "Thời lượng được bỏ qua khi hiệu ứng đang lặp liên tục."}
          </p>
        ) : isAudio ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Âm thanh phát đúng một lần. Mốc này chỉ dừng file dài hơn; không kéo
            dài hoặc phát lại file ngắn.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <label
            htmlFor={delayId}
            className="flex items-center gap-1.5 font-medium text-muted-foreground"
          >
            <Timer className="h-3.5 w-3.5" aria-hidden="true" />
            Độ trễ (Delay)
          </label>
          <output htmlFor={delayId} className="font-mono font-semibold text-foreground">
            {effect.delay_ms ?? 0}ms
          </output>
        </div>
        <input
          id={delayId}
          type="range"
          min={0}
          max={3000}
          step={50}
          value={effect.delay_ms ?? 0}
          onChange={(event) =>
            onChange({ delay_ms: Number.parseInt(event.target.value, 10) })
          }
          className={`min-h-11 w-full cursor-pointer accent-primary ${focusRing}`}
        />
      </div>

      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 p-3 transition-colors hover:bg-secondary/80 motion-reduce:transition-none">
        <span className="flex min-w-0 items-start gap-2">
          <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="flex flex-col">
            <span className="text-sm font-medium text-foreground">Lặp lại liên tục</span>
            <span className="text-xs text-muted-foreground">
              {isAudio
                ? "Phát lặp lại trong thời gian block đang hoạt động."
                : "Duy trì hoạt ảnh cho tới khi block không còn hoạt động."}
            </span>
          </span>
        </span>
        <input
          type="checkbox"
          checked={effect.loop ?? false}
          onChange={(event) =>
            onChange({
              loop: event.target.checked,
              ...(!event.target.checked && effect.duration_ms < 200
                ? { duration_ms: 2000 }
                : {}),
            })
          }
          className={`h-5 w-5 shrink-0 cursor-pointer rounded border-border accent-primary ${focusRing}`}
        />
      </label>
    </section>
  );
});
