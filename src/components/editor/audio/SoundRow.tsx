"use client";

import type { ReactNode } from "react";
import { Check, Play, Square } from "lucide-react";

export const audioFocusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/** Shared presentation for system presets, personal assets and search results. */
export default function SoundRow({ title, description, playing, selected = false, onPreview, onSelect, action }: {
  title: string;
  description: ReactNode;
  playing: boolean;
  selected?: boolean;
  onPreview(): void;
  onSelect?: () => void;
  action?: ReactNode;
}) {
  const text = <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium" title={title}>{title}</span><span className="block truncate text-[11px] text-muted-foreground">{description}</span></span>;
  return (
    <div className={`flex min-h-14 min-w-0 flex-wrap items-center gap-1 rounded-xl border p-1.5 transition-colors motion-reduce:transition-none ${selected ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40" : "border-border bg-secondary/30 text-foreground hover:bg-secondary/70"}`}>
      <button type="button" onClick={onPreview} aria-label={`${playing ? "Dừng phát" : "Nghe thử"} ${title}`} aria-pressed={playing}
        className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg ${audioFocusRing} ${playing ? "bg-destructive/15 text-destructive hover:bg-destructive/25" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>
        {playing ? <Square className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
      </button>
      {onSelect ? (
        <button type="button" onClick={onSelect} aria-pressed={selected} className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left ${audioFocusRing}`}>
          {text}{selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
        </button>
      ) : <div className="flex min-h-11 min-w-0 flex-1 items-center px-2">{text}</div>}
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  );
}
