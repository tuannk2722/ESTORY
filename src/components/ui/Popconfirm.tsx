// components/ui/Popconfirm.tsx
// Phase 2: Popconfirm nhỏ gọn, định vị thông minh ngay cạnh icon trigger (US-2.2, US-2.7)
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Trash2, AlertTriangle, Info, X } from "lucide-react";

export type PopconfirmVariant = "danger" | "warning" | "info";

export interface PopconfirmProps {
  title: string;
  description?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  children: React.ReactElement;
  variant?: PopconfirmVariant;
  confirmText?: string;
  cancelText?: string;
  disabled?: boolean;
  /**
   * Điều kiện kích hoạt:
   * - boolean hoặc callback trả về boolean.
   * - Nếu `false`, khi click trigger sẽ thực hiện ngay onConfirm() mà KHÔNG hiển thị popover.
   * - Nếu `true` (mặc định), sẽ mở popover xác nhận.
   */
  shouldConfirm?: boolean | (() => boolean);
  placement?: "top" | "bottom" | "auto";
}

export default function Popconfirm({
  title,
  description,
  onConfirm,
  onCancel,
  children,
  variant = "danger",
  confirmText = "Xóa",
  cancelText = "Hủy",
  disabled = false,
  shouldConfirm = true,
  placement = "auto",
}: PopconfirmProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  // Tính toán vị trí hiển thị thông minh (không bị tràn màn hình hay bị che khuất)
  const updatePosition = useCallback(() => {
    if (!isOpen || !triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 270; // Độ rộng tiêu chuẩn cho popconfirm
    const popoverHeight = 125; // Ước lượng chiều cao popconfirm
    const padding = 12;

    // Tính tọa độ ngang (left)
    let left = triggerRect.right - popoverWidth;
    if (left < padding) {
      left = triggerRect.left;
    }
    if (left + popoverWidth > window.innerWidth - padding) {
      left = window.innerWidth - popoverWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }

    // Tính tọa độ dọc (top)
    let top = triggerRect.bottom + 8;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    if (placement === "top" || (placement === "auto" && spaceBelow < popoverHeight + padding && spaceAbove > spaceBelow)) {
      top = triggerRect.top - popoverHeight - 8;
    }

    setCoords({
      top: Math.max(padding, top),
      left,
      width: popoverWidth,
    });
  }, [isOpen, placement]);

  // Cập nhật vị trí khi mở, resize hoặc cuộn trang
  useEffect(() => {
    if (!isOpen) {
      setCoords(null);
      return;
    }

    updatePosition();
    const animId = requestAnimationFrame(updatePosition);

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Click outside & Escape listener
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
        if (onCancel) onCancel();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        if (onCancel) onCancel();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCancel]);

  // Trigger click handler
  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    // Kiểm tra điều kiện có cần xác nhận hay không
    const needConfirm = typeof shouldConfirm === "function" ? shouldConfirm() : shouldConfirm;

    if (!needConfirm) {
      // Không cần xác nhận -> thực thi ngay lập tức
      onConfirm();
      return;
    }

    // Cần xác nhận -> Mở Popconfirm
    setIsOpen((prev) => !prev);
  };

  const handleConfirmClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onConfirm();
  };

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (onCancel) onCancel();
  };

  // Clone trigger element để gán ref & onClick
  const triggerElement = React.cloneElement(children, {
    // @ts-expect-error ref assignment on cloned element
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const { ref } = children as any;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    onClick: handleTriggerClick,
  });

  const getVariantStyles = () => {
    switch (variant) {
      case "warning":
        return {
          icon: AlertTriangle,
          iconColor: "text-amber-500",
          iconBg: "bg-amber-500/10 border-amber-500/20",
          btnColor: "bg-amber-600 hover:bg-amber-700 text-white shadow-xs shadow-amber-600/25",
        };
      case "info":
        return {
          icon: Info,
          iconColor: "text-primary",
          iconBg: "bg-primary/10 border-primary/20",
          btnColor: "bg-primary hover:bg-primary-hover text-white shadow-xs shadow-primary/25",
        };
      case "danger":
      default:
        return {
          icon: Trash2,
          iconColor: "text-red-500",
          iconBg: "bg-red-500/10 border-red-500/20",
          btnColor: "bg-red-600 hover:bg-red-700 text-white shadow-xs shadow-red-600/25",
        };
    }
  };

  const variantStyle = getVariantStyles();
  const Icon = variantStyle.icon;

  const popoverNode = isOpen && coords && (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${coords.width}px`,
        zIndex: 90,
      }}
      className="bg-card/95 border border-border/80 text-foreground rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl animate-fade-in font-editor text-xs flex flex-col gap-3"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Info */}
      <div className="flex items-start gap-2.5">
        <div className={`p-1.5 rounded-lg ${variantStyle.iconBg} ${variantStyle.iconColor} border shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <div className="font-bold text-foreground text-xs leading-snug">{title}</div>
          {description && (
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-normal font-editor">
              {description}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleCancelClick}
          className="absolute top-2.5 right-2.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Buttons Actions */}
      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/40">
        <button
          type="button"
          onClick={handleCancelClick}
          className="px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border/60 text-xs font-medium cursor-pointer transition-colors min-h-[30px]"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={handleConfirmClick}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors min-h-[30px] ${variantStyle.btnColor}`}
        >
          {confirmText}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {triggerElement}
      {typeof document !== "undefined" && popoverNode && createPortal(popoverNode, document.body)}
    </>
  );
}
