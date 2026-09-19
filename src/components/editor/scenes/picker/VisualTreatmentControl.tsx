"use client";

import { ImageIcon, Loader2, Sparkles } from "lucide-react";
import type { SceneDraft } from "@/lib/scenes/sceneDraft";

export type TreatmentDerivationStatus =
  | "idle"
  | "deriving"
  | "ready"
  | "fallback";

export function VisualTreatmentControl({
  mode,
  status,
  disabled,
  onChange,
}: {
  mode: SceneDraft["treatmentMode"];
  status: TreatmentDerivationStatus;
  disabled: boolean;
  onChange: (mode: "auto" | "original") => void;
}) {
  const optionClass = (selected: boolean) =>
    `min-h-20 rounded-xl border px-3 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${selected
      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
      : "border-border/70 bg-card hover:border-primary/40 hover:bg-secondary/40"
    }`;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-foreground">Màu nền</p>

      {mode === "legacy" && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Scene này đang giữ bảng màu cũ. Chỉ khi bạn chọn một chế độ bên dưới hoặc đổi nền, Scene mới chuyển sang cơ chế màu mới.
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Xử lý màu nền">
        <button
          type="button"
          role="radio"
          aria-checked={mode === "auto"}
          disabled={disabled}
          onClick={() => onChange("auto")}
          className={optionClass(mode === "auto")}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            Tự động
          </span>
          <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
            Sinh màu dựa theo bối cảnh đã chọn.
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "original"}
          disabled={disabled}
          onClick={() => onChange("original")}
          className={optionClass(mode === "original")}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ImageIcon className="h-4 w-4 text-accent" aria-hidden="true" />
            Giữ màu gốc
          </span>
          <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
            Không thêm sắc màu trang trí.
          </span>
        </button>
      </div>

      <div className="min-h-5 text-[11px] text-muted-foreground" aria-live="polite">
        {status === "deriving" && (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Đang phân tích màu nền. Bạn vẫn có thể lưu Scene với phương án an toàn.
          </span>
        )}
        {status === "ready" && mode === "auto" && (
          <span>Đã tạo màu nhấn từ bối cảnh và lưu trực tiếp trong Scene.</span>
        )}
        {status === "fallback" && (
          <span className="text-amber-700 dark:text-amber-300">
            Không thể đọc màu từ nền này. Scene đã chuyển sang chế độ Giữ màu gốc và vẫn có thể lưu.
          </span>
        )}
      </div>
    </div>
  );
}
