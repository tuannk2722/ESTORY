"use client";

import React from "react";
import { useReaderSettings } from "@/components/ui/ThemeProvider";

export interface ReaderPlaybackStatusProps {
  onOpenSettings?: () => void;
  className?: string;
}

export default function ReaderPlaybackStatus({
  onOpenSettings,
  className = "",
}: ReaderPlaybackStatusProps) {
  const { settings } = useReaderSettings();
  const disabledCategoryCount = Object.values(
    settings.effects_by_category ?? {}
  ).filter((enabled) => enabled === false).length;

  let label: string | null = null;
  let compactLabel: string | null = null;
  let description: string | null = null;

  if (!settings.effects_enabled) {
    label = "Hiệu ứng đang tắt";
    compactLabel = "Hiệu ứng tắt";
    description = "Reader Settings đang tắt toàn bộ hiệu ứng.";
  } else if (settings.reduced_motion) {
    label = "Đang giảm chuyển động";
    compactLabel = "Giảm chuyển động";
    description = "Các hiệu ứng chuyển động được thay bằng trạng thái tĩnh.";
  } else if (disabledCategoryCount > 0) {
    label = "Một số hiệu ứng đang tắt";
    compactLabel = "Hiệu ứng hạn chế";
    description = `${disabledCategoryCount} nhóm hiệu ứng đang bị tắt trong Reader Settings.`;
  } else if ((settings.intensity_multiplier ?? 1) === 0) {
    label = "Cường độ hiệu ứng 0%";
    compactLabel = "Cường độ 0%";
    description = "Hiệu ứng đang bật nhưng cường độ toàn cục được đặt về 0%.";
  }

  if (!label || !compactLabel || !description) return null;

  const status = (
    <span
      aria-hidden="true"
      className="flex min-h-9 items-center whitespace-nowrap rounded-lg border border-accent/50 bg-accent/10 px-2.5 py-1.5 text-xs text-foreground"
    >
      <span className="hidden max-w-44 truncate md:inline">{label}</span>
      <span className="md:hidden">{compactLabel}</span>
    </span>
  );

  return (
    <div className={`flex items-center font-editor ${className}`}>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {label}. {description}
      </span>
      {onOpenSettings ? (
        <button
          type="button"
          onClick={onOpenSettings}
          title={`${label}. ${description}`}
          aria-label={`${label}. ${description} Mở Reader Settings`}
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {status}
        </button>
      ) : (
        <span title={`${label}. ${description}`}>{status}</span>
      )}
    </div>
  );
}
