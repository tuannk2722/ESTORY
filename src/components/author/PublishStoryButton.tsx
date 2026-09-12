"use client";

import { Send } from "lucide-react";
import { submitReadiness, type SubmitReadinessStory } from "./storyRules";

interface PublishStoryButtonProps {
  story: SubmitReadinessStory;
  busy?: boolean;
  onSubmit(): void;
  compact?: boolean;
  disabledReason?: string;
}

export default function PublishStoryButton({ story, busy = false, onSubmit, compact = false, disabledReason }: PublishStoryButtonProps) {
  const readiness = submitReadiness(story);
  const disabled = busy || !readiness.ready || Boolean(disabledReason);
  const reasons = disabledReason ? [disabledReason] : readiness.reasons;
  const explanationId = `submit-${story.id}-explanation`;
  const label = story.status === "rejected" ? "Gửi lại duyệt" : "Gửi duyệt";
  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <button
        type="button"
        disabled={disabled}
        onClick={onSubmit}
        aria-describedby={reasons.length > 0 ? explanationId : undefined}
        title={reasons[0]}
        className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        <Send aria-hidden="true" className="h-4 w-4" /> {label}
      </button>
      {reasons.length > 0 ? (
        <p id={explanationId} className={`${compact ? "max-w-60" : "max-w-xl"} text-xs leading-relaxed text-[var(--color-muted-foreground)]`}>
          {reasons.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
