// components/editor/PreviewToggle.tsx
// Phase 2: Author Editor - Chuyển đổi giữa chế độ soạn thảo và xem trước (US-2.5)
"use client";

import React from "react";
import { Edit3, Eye } from "lucide-react";

export interface PreviewToggleProps {
  isPreview: boolean;
  onToggle: (preview: boolean) => void;
}

export default function PreviewToggle({ isPreview, onToggle }: PreviewToggleProps) {
  return (
    <div className="flex items-center p-1 rounded-xl bg-secondary/60 border border-border">
      <button
        type="button"
        onClick={() => onToggle(false)}
        className={`px-3 py-1.5 rounded-lg text-xs font-editor font-medium transition-all flex items-center gap-1.5 cursor-pointer min-h-[38px] ${!isPreview
          ? "bg-editor-action text-editor-action-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
          }`}
      >
        <Edit3 className="w-3.5 h-3.5" />
        Soạn Thảo
      </button>

      <button
        type="button"
        onClick={() => onToggle(true)}
        className={`px-3 py-1.5 rounded-lg text-xs font-editor font-medium transition-all flex items-center gap-1.5 cursor-pointer min-h-[38px] ${isPreview
          ? "bg-editor-action text-editor-action-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
          }`}
      >
        <Eye className="w-3.5 h-3.5" />
        Xem Trước
      </button>
    </div>
  );
}
