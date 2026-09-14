import {
  Archive,
  CircleCheck,
  CircleX,
  Clock3,
  FilePenLine,
  type LucideIcon,
} from "lucide-react";
import type { StoryStatus } from "@/types/story";

const statusPresentation: Record<StoryStatus, {
  label: string;
  icon: LucideIcon;
  className: string;
  mediaClassName: string;
}> = {
  draft: {
    label: "Nháp",
    icon: FilePenLine,
    className: "border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
    mediaClassName: "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)]",
  },
  pending_review: {
    label: "Chờ duyệt",
    icon: Clock3,
    className: "border-[var(--color-warning)]/35 bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    mediaClassName: "border-[var(--color-warning)]/60 bg-[var(--color-card)] text-[var(--color-warning)]",
  },
  published: {
    label: "Đã xuất bản",
    icon: CircleCheck,
    className: "border-[var(--color-success)]/35 bg-[var(--color-success)]/15 text-[var(--color-success)]",
    mediaClassName: "border-[var(--color-success)]/60 bg-[var(--color-card)] text-[var(--color-success)]",
  },
  rejected: {
    label: "Bị từ chối",
    icon: CircleX,
    className: "border-[var(--color-destructive)]/35 bg-[var(--color-destructive)]/15 text-[var(--color-destructive)]",
    mediaClassName: "border-[var(--color-destructive)]/60 bg-[var(--color-card)] text-[var(--color-destructive)]",
  },
  archived: {
    label: "Lưu trữ",
    icon: Archive,
    className: "border-[var(--color-border)] bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]",
    mediaClassName: "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)]",
  },
};

export const STORY_STATUS_FILTERS = [
  { id: "pending_review", label: "Chờ duyệt" },
  { id: "published", label: "Đã xuất bản" },
  { id: "rejected", label: "Bị từ chối" },
  { id: "draft", label: "Nháp" },
  { id: "archived", label: "Lưu trữ" },
  { id: "all", label: "Tất cả" },
] as const;

export default function StoryStatusBadge({
  status,
  onMedia = false,
}: {
  status: StoryStatus;
  onMedia?: boolean;
}) {
  const presentation = statusPresentation[status];
  const Icon = presentation.icon;
  return (
    <span className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${onMedia ? `${presentation.mediaClassName} shadow-lg ring-1 ring-black/15` : presentation.className}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {presentation.label}
    </span>
  );
}
