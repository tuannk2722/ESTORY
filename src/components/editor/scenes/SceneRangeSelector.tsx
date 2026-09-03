"use client";

import React from "react";
import { Check, X } from "lucide-react";

export interface SceneRangeSelectorProps {
  isSelectingRange: boolean;
  startIndex: number | null;
  endIndex: number | null;
  hasInvalidBoundary: boolean;
  onStartRangeSelection: () => void;
  onCancelRangeSelection: () => void;
  onProceedToCreate: () => void;
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

export const SceneRangeSelector = React.memo(function SceneRangeSelector({
  isSelectingRange,
  startIndex,
  endIndex,
  hasInvalidBoundary,
  onStartRangeSelection,
  onCancelRangeSelection,
  onProceedToCreate,
}: SceneRangeSelectorProps) {
  if (!isSelectingRange) {
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={onStartRangeSelection}
          className={`w-full min-h-[44px] py-2.5 px-3 rounded-xl border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-2 transition-colors motion-reduce:transition-none cursor-pointer shadow-xs ${focusRing}`}
        >
          <span>+ Tạo Scene Cho Dải Block</span>
        </button>
      </div>
    );
  }

  let hintText = "1. Nhấp chọn block BẮT ĐẦU trong danh sách hoặc nội dung.";
  if (hasInvalidBoundary) {
    hintText = "Dải đang chọn không còn hợp lệ. Hãy hủy và chọn lại.";
  } else if (startIndex !== null && endIndex === null) {
    hintText = `Đã chọn điểm đầu: #${startIndex + 1}. Nhấp chọn block KẾT THÚC hoặc tiếp tục để tạo Scene một block.`;
  } else if (startIndex !== null && endIndex !== null) {
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    hintText = `Đã chọn: #${minIndex + 1} → #${maxIndex + 1} (${maxIndex - minIndex + 1} đoạn văn).`;
  }

  return (
    <section
      aria-live="polite"
      className="mb-4 p-3 rounded-2xl bg-primary/10 border border-primary/30 text-xs text-primary space-y-2.5 animate-fade-in motion-reduce:animate-none"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-semibold">
          <span>Đang chọn dải block:</span>
        </div>
        <button
          type="button"
          onClick={onCancelRangeSelection}
          className={`min-h-[44px] min-w-[44px] rounded-lg hover:bg-primary/20 transition-colors motion-reduce:transition-none cursor-pointer flex items-center justify-center ${focusRing}`}
          aria-label="Hủy chọn dải block"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <p className="text-[11px] text-foreground/80 leading-relaxed">{hintText}</p>

      {startIndex !== null && !hasInvalidBoundary && (
        <button
          type="button"
          onClick={onProceedToCreate}
          className={`w-full min-h-[44px] py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 text-editor-action-foreground text-xs font-bold flex items-center justify-center gap-1.5 transition-colors motion-reduce:transition-none shadow-sm cursor-pointer ${focusRing}`}
        >
          <Check className="w-4 h-4" aria-hidden="true" />
          <span>Tiếp Tục Tạo Scene</span>
        </button>
      )}
    </section>
  );
});
