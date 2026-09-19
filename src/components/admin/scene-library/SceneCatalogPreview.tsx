"use client";

import { Pause, Play } from "lucide-react";
import { useMemo, useState } from "react";
import SceneBackground from "@/components/scenes/SceneBackground";
import SceneLayer from "@/components/scenes/SceneLayer";
import { useReaderSettings } from "@/components/ui/ThemeProvider";
import { backgroundSnapshotToPresentation } from "@/lib/scenes/scene-presentation";
import { DEFAULT_SCENE_ACCENT_COLOR, SCENE_BODY_TEXT_COLOR } from "@/lib/scenes/scene-visual-policy";
import type { BackgroundRenderSnapshot, PaletteRenderSnapshot, SceneRenderConfigV2 } from "@/types/scene";

export default function SceneCatalogPreview({
  background,
  palette,
  label = "Xem trước bối cảnh đọc",
  compact = false,
}: {
  background?: BackgroundRenderSnapshot;
  palette?: PaletteRenderSnapshot;
  label?: string;
  compact?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const { settings, isMounted } = useReaderSettings();
  const prefersReducedMotion = !isMounted || Boolean(settings.reduced_motion);
  const [reducedMotionOverride, setReducedMotionOverride] = useState<boolean | null>(null);
  const reducedMotion = reducedMotionOverride ?? prefersReducedMotion;
  const canPreview = !compact && background?.motion === "looping";
  const previewReducedMotion = reducedMotion || (canPreview && !playing);
  const presentation = useMemo(
    () => background ? backgroundSnapshotToPresentation(background) : null,
    [background],
  );
  const originalConfig = useMemo<SceneRenderConfigV2 | null>(
    () => background ? {
      schema_version: 2,
      background,
      visual_treatment: { mode: "original", accent_color: DEFAULT_SCENE_ACCENT_COLOR },
      ambient_effects: [],
    } : null,
    [background],
  );
  const originalSample = !compact ? (
    <article className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-7" style={{ color: SCENE_BODY_TEXT_COLOR }}>
      <p className="font-story text-[11px] uppercase tracking-[0.18em]">Chương XII</p>
      <h3 className="mt-2 inline-block border-b-2 pb-1 text-xl font-display font-bold sm:text-2xl" style={{ borderColor: DEFAULT_SCENE_ACCENT_COLOR }}>
        Khu rừng sau cơn mưa
      </h3>
      <p className="mt-2 max-w-xl font-story text-sm leading-6">
        <span className="float-left mr-1 font-display text-3xl font-bold leading-7" style={{ filter: `drop-shadow(0 2px 10px ${DEFAULT_SCENE_ACCENT_COLOR})` }}>Á</span>
        nh sáng len qua tán lá. Câu chuyện mở ra trong khu rừng sau cơn mưa.
      </p>
    </article>
  ) : null;

  return (
    <section aria-label={label} className={compact ? "" : "space-y-2"}>
      {canPreview ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-5 text-[var(--color-muted-foreground)]">
            {reducedMotion
              ? "Chế độ giảm chuyển động dùng khung tĩnh."
              : playing ? "Bối cảnh đang chuyển động." : "Bấm Preview để xem chuyển động."}
          </p>
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
      ) : null}
      {!compact && background?.motion === "looping" ? (
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--color-muted-foreground)]">
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(event) => setReducedMotionOverride(event.target.checked)}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          Xem fallback giảm chuyển động
        </label>
      ) : null}
      <div className={`relative isolate aspect-video overflow-hidden bg-slate-950 ${compact ? "" : "rounded-2xl border border-[var(--color-border)]"}`}>
        {palette ? (
          <>
            {presentation ? <SceneBackground asset={presentation} reducedMotion={compact || previewReducedMotion} /> : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,#334155,#0f172a_52%,#020617)]" />
            )}
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{ backgroundColor: palette.background_tint.color, opacity: palette.background_tint.opacity }}
            />
            {!compact ? (
              <article className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-5 sm:p-7">
                <p className="font-story text-[11px] uppercase tracking-[0.18em]" style={{ color: palette.accent }}>
                  Chương XII
                </p>
                <h3 className="mt-2 text-2xl font-display font-bold" style={{ color: SCENE_BODY_TEXT_COLOR }}>
                  Khu rừng sau cơn mưa
                </h3>
                <p className="mt-2 max-w-xl font-story text-sm leading-6" style={{ color: SCENE_BODY_TEXT_COLOR }}>
                  <span className="float-left mr-1 font-display text-3xl font-bold leading-7" style={{ color: palette.primary }}>Á</span>
                  nh sáng len qua tán lá. Lời thoại được đánh dấu bằng đường viền màu nhấn nhưng phần chữ truyện luôn giữ màu sáng cố định.
                </p>
              </article>
            ) : null}
          </>
        ) : originalConfig ? (
          compact ? <SceneBackground asset={presentation ?? undefined} reducedMotion /> : (
            <SceneLayer renderConfig={originalConfig} reducedMotion={previewReducedMotion} contained>
              {originalSample}
            </SceneLayer>
          )
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,#334155,#0f172a_52%,#020617)]" />
            {originalSample}
          </>
        )}
      </div>
    </section>
  );
}
