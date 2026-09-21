"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  convertDraftToV2,
  type SceneDraft,
} from "@/lib/scenes/sceneDraft";
import {
  createOriginalVisualTreatment,
  deriveVisualTreatmentFromBackground,
} from "@/lib/scenes/visual-treatment";
import type { BackgroundRenderSnapshot } from "@/types/scene";
import type { EffectConfig } from "@/types/story";
import type { BackgroundOption } from "./BackgroundPicker";
import { BackgroundPicker } from "./BackgroundPicker";
import { SceneEffectsEditor } from "./SceneEffectsEditor";
import { SceneAudioEditor } from "./SceneAudioEditor";
import {
  VisualTreatmentControl,
  type TreatmentDerivationStatus,
} from "./VisualTreatmentControl";

export interface CustomSceneTabProps {
  draft: SceneDraft;
  onChangeDraft: (updater: (previous: SceneDraft) => SceneDraft) => void;
  backgrounds: BackgroundOption[];
  initialBackgroundId?: string;
  initialAudioSrc?: string;
  isLoop?: boolean;
}

const SAVED_BACKGROUND_ID = "snapshot:current-background";

export const CustomSceneTab = React.memo(function CustomSceneTab({
  draft,
  onChangeDraft,
  backgrounds,
  initialBackgroundId,
  initialAudioSrc,
  isLoop = true,
}: CustomSceneTabProps) {
  const derivationRequest = useRef(0);
  const [derivationStatus, setDerivationStatus] =
    useState<TreatmentDerivationStatus>("idle");

  useEffect(
    () => () => {
      derivationRequest.current += 1;
    },
    [],
  );

  const deriveAutoTreatment = useCallback(
    (background: BackgroundRenderSnapshot) => {
      const request = ++derivationRequest.current;
      const fallback = createOriginalVisualTreatment();
      setDerivationStatus("deriving");
      onChangeDraft((previous) =>
        convertDraftToV2(previous, fallback, "auto"),
      );

      void deriveVisualTreatmentFromBackground(background).then((treatment) => {
        if (derivationRequest.current !== request) return;
        onChangeDraft((previous) =>
          convertDraftToV2(previous, treatment, treatment.mode),
        );
        setDerivationStatus(treatment.mode === "auto" ? "ready" : "fallback");
      });
    },
    [onChangeDraft],
  );

  const handleSelectBackground = useCallback(
    (backgroundId: string) => {
      // Re-selecting the current snapshot is a no-op. In particular, opening a
      // legacy Scene and clicking "Nền hiện tại" must not opt it into v2.
      if (backgroundId === draft.backgroundId) return;
      const selected = backgrounds.find((item) => item.id === backgroundId);
      if (!selected) return;
      const background = structuredClone(selected.render);

      onChangeDraft((previous) => ({
        ...previous,
        backgroundId: backgroundId === SAVED_BACKGROUND_ID ? "" : backgroundId,
        background,
      }));
      deriveAutoTreatment(background);
    },
    [backgrounds, deriveAutoTreatment, draft.backgroundId, onChangeDraft],
  );

  const handleTreatmentChange = useCallback(
    (mode: "auto" | "original") => {
      if (!draft.background) return;
      if (mode === "auto") {
        deriveAutoTreatment(structuredClone(draft.background));
        return;
      }

      derivationRequest.current += 1;
      setDerivationStatus("idle");
      onChangeDraft((previous) =>
        convertDraftToV2(previous, createOriginalVisualTreatment(), "original"),
      );
    },
    [deriveAutoTreatment, draft.background, onChangeDraft],
  );

  const handleChangeEffects = useCallback(
    (effects: EffectConfig[]) => {
      onChangeDraft((previous) => ({
        ...previous,
        ambientEffects: effects,
      }));
    },
    [onChangeDraft],
  );

  const handleChangeAudio = useCallback(
    (audio: EffectConfig | null) => {
      onChangeDraft((previous) => ({
        ...previous,
        ambientAudio: audio,
      }));
    },
    [onChangeDraft],
  );

  return (
    <div className="space-y-6 font-editor">
      <BackgroundPicker
        backgrounds={backgrounds}
        selectedBackgroundId={draft.backgroundId}
        onSelectBackground={handleSelectBackground}
        initialBackgroundId={initialBackgroundId}
      />

      <section className="space-y-4 rounded-2xl border border-border/60 bg-secondary/30 px-4 py-3">
        <h3 className="text-sm font-bold text-foreground font-ui">
          2. Màu sắc
        </h3>
        <div>
          <VisualTreatmentControl
            mode={draft.treatmentMode}
            status={derivationStatus}
            disabled={!draft.background}
            onChange={handleTreatmentChange}
          />
        </div>
      </section>

      <section className="min-w-0 space-y-4 rounded-2xl border border-border/60 bg-secondary/30 p-4">
        <h3 className="text-sm font-bold text-foreground font-ui">3. Âm thanh nền</h3>
        <SceneAudioEditor
          ambientAudio={draft.ambientAudio}
          onChangeAudio={handleChangeAudio}
          initialAudioSrc={initialAudioSrc}
        />
      </section>

      <SceneEffectsEditor
        ambientEffects={draft.ambientEffects}
        onChangeEffects={handleChangeEffects}
        isLoop={isLoop}
      />
    </div>
  );
});

export default CustomSceneTab;
