import type { StoryStatus } from "@/types/story";
import { STORY_STATUS_LABELS } from "./types";

const STATUS_STYLES: Record<StoryStatus, string> = {
  draft: "border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
  pending_review: "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  published: "border-[var(--color-success)]/30 bg-[var(--color-success)]/15 text-[var(--color-success)]",
  rejected: "border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/15 text-[var(--color-destructive)]",
  archived: "border-[var(--color-border)] bg-[var(--color-secondary)]/60 text-[var(--color-muted-foreground)] opacity-80",
};

const MEDIA_STATUS_STYLES: Record<StoryStatus, string> = {
  draft: "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)]",
  pending_review: "border-[var(--color-warning)]/60 bg-[var(--color-card)] text-[var(--color-warning)]",
  published: "border-[var(--color-success)]/60 bg-[var(--color-card)] text-[var(--color-success)]",
  rejected: "border-[var(--color-destructive)]/60 bg-[var(--color-card)] text-[var(--color-destructive)]",
  archived: "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)]",
};

export default function StatusBadge({ status, onMedia = false }: { status: StoryStatus; onMedia?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${onMedia ? `${MEDIA_STATUS_STYLES[status]} shadow-lg ring-1 ring-black/15` : STATUS_STYLES[status]}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {STORY_STATUS_LABELS[status]}
    </span>
  );
}
