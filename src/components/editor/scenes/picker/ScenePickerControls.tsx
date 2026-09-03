"use client";

import { Check, Eye, ImageIcon, Sliders } from "lucide-react";

export type ScenePickerMode = "preset" | "custom";

export function ScenePickerModeTabs({
  mode,
  presetCount,
  onChange,
}: {
  mode: ScenePickerMode;
  presetCount: number;
  onChange: (mode: ScenePickerMode) => void;
}) {
  const tabClass = (selected: boolean) =>
    `flex min-h-11 cursor-pointer items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring motion-reduce:transition-none ${selected
      ? "border-primary text-primary"
      : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div role="tablist" aria-label="Cách tạo Scene" className="mb-5 flex overflow-x-auto border-b border-border/60">
      <button type="button" role="tab" aria-selected={mode === "preset"} onClick={() => onChange("preset")} className={tabClass(mode === "preset")}>
        <ImageIcon className="h-4 w-4" aria-hidden="true" />
        Scene Preset ({presetCount})
      </button>
      <button type="button" role="tab" aria-selected={mode === "custom"} onClick={() => onChange("custom")} className={tabClass(mode === "custom")}>
        <Sliders className="h-4 w-4" aria-hidden="true" />
        Tùy Chỉnh Phối Riêng
      </button>
    </div>
  );
}

export function ScenePickerFooter({
  mode,
  editing,
  disabled,
  onPreview,
  onSave,
}: {
  mode: ScenePickerMode;
  editing: boolean;
  disabled: boolean;
  onPreview: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="hidden text-xs text-muted-foreground sm:block">
        {mode === "preset" ? "Preset được sao chép độc lập vào Scene của bạn." : "Bối cảnh tùy chỉnh được lưu riêng cho chương này."}
      </p>
      <div className="flex w-full items-center justify-end gap-2.5 sm:w-auto">
        <button type="button" onClick={onPreview} disabled={disabled} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none">
          <Eye className="h-4 w-4" aria-hidden="true" />
          <span>Xem Trước</span>
        </button>
        <button type="button" onClick={onSave} disabled={disabled} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-editor-action px-5 py-2 text-sm font-semibold text-editor-action-foreground shadow-md transition-colors hover:bg-editor-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none">
          <Check className="h-4 w-4" aria-hidden="true" />
          <span>{editing ? "Cập Nhật Scene" : "Áp Dụng Scene"}</span>
        </button>
      </div>
    </div>
  );
}
