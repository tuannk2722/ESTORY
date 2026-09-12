"use client";

import { Plus } from "lucide-react";

interface InsertGapButtonProps {
  id?: string;
  label: string;
  ariaLabel: string;
  disabled?: boolean;
  onClick(): void;
}

export default function InsertGapButton({ id, label, ariaLabel, disabled = false, onClick }: InsertGapButtonProps) {
  return (
    <button
      id={id}
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="group/gap relative my-1 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 h-px bg-transparent transition-colors group-hover/gap:bg-primary/40 group-focus-visible/gap:bg-primary/50 group-active/gap:bg-primary/50 group-disabled/gap:bg-transparent motion-reduce:transition-none"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute z-10 inline-flex min-h-7 scale-75 items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-editor font-medium text-primary-foreground opacity-0 shadow-md transition-[opacity,transform] duration-200 group-hover/gap:scale-100 group-hover/gap:opacity-100 group-focus-visible/gap:scale-100 group-focus-visible/gap:opacity-100 group-active/gap:scale-100 group-active/gap:opacity-100 group-disabled/gap:scale-75 group-disabled/gap:opacity-0 motion-reduce:scale-100 motion-reduce:transition-none"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>{label}</span>
      </span>
    </button>
  );
}
