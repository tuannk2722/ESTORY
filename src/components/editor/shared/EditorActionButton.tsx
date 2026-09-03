// src/components/editor/shared/EditorActionButton.tsx
// Accessible Action Button with touch target >= 44px and loading state

"use client";

import React from "react";
import { type LucideIcon, Loader2 } from "lucide-react";

export interface EditorActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "action" | "danger" | "ghost";
  loading?: boolean;
}

export const EditorActionButton = React.memo(function EditorActionButton({
  label,
  icon: Icon,
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
  children,
  ...props
}: EditorActionButtonProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "action":
        return "bg-editor-action hover:bg-editor-action-hover text-editor-action-foreground shadow-md";
      case "secondary":
        return "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border";
      case "danger":
        return "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs";
      case "ghost":
        return "text-muted-foreground hover:text-foreground hover:bg-secondary/50";
      case "primary":
      default:
        return "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm";
    }
  };

  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`min-h-[44px] px-4 py-2 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${getVariantStyles()} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Đang xử lý...</span>
        </>
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4" />}
          <span>{children || label}</span>
        </>
      )}
    </button>
  );
});
