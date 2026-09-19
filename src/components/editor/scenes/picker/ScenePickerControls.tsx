"use client";

import { Check, Eye } from "lucide-react";

export function ScenePickerFooter({
  editing,
  disabled,
  onPreview,
  onSave,
}: {
  editing: boolean;
  disabled: boolean;
  onPreview: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="hidden text-xs text-muted-foreground sm:block">
        Bối cảnh và màu đã xử lý được lưu thành snapshot riêng của Scene.
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
