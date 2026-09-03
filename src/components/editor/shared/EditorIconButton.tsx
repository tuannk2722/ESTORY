// src/components/editor/shared/EditorIconButton.tsx
// Accessible Icon Button with guaranteed >= 44x44px touch target

"use client";

import React from "react";
import { type LucideIcon } from "lucide-react";

export interface EditorIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  variant?: "default" | "primary" | "secondary" | "danger" | "ghost";
  iconSize?: string;
}

export const EditorIconButton = React.memo(function EditorIconButton({
  icon: Icon,
  label,
  variant = "default",
  iconSize = "w-5 h-5",
  className = "",
  disabled = false,
  ...props
}: EditorIconButtonProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs";
      case "secondary":
        return "bg-secondary text-secondary-foreground hover:bg-secondary/80";
      case "danger":
        return "text-destructive hover:bg-destructive/10 hover:text-destructive";
      case "ghost":
        return "text-muted-foreground hover:text-foreground hover:bg-transparent";
      case "default":
      default:
        return "text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/60 shadow-2xs";
    }
  };

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      className={`min-h-[44px] min-w-[44px] p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${getVariantStyles()} ${className}`}
      {...props}
    >
      <Icon className={iconSize} />
    </button>
  );
});
