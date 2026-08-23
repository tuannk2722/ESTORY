"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  User,
  Moon,
  Sun,
  BookOpen,
  LogIn,
  Check,
  ChevronDown,
} from "lucide-react";
import { useReaderSettings } from "./ThemeProvider";

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { settings, setTheme } = useReaderSettings();

  // Đóng menu khi click ra ngoài hoặc bấm phím Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const themes = [
    { id: "dark", label: "Dark OLED", icon: Moon },
    { id: "light", label: "Paper Light", icon: Sun },
    { id: "sepia", label: "Sepia Warm", icon: BookOpen },
  ] as const;

  return (
    <div className="relative" ref={menuRef}>
      {/* Nút Trigger Avatar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 p-1.5 rounded-full border transition-all duration-200 cursor-pointer min-h-[44px] min-w-[44px] justify-center ${isOpen
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)] shadow-sm"
          : "border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-accent)] text-[var(--color-foreground)]"
          }`}
        aria-label="Mở menu người dùng và cài đặt"
        aria-expanded={isOpen}
      >
        <div className="w-8 h-8 rounded-full bg-[var(--color-secondary)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-foreground)]">
          <User className="w-4 h-4 text-[var(--color-accent)]" />
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--color-muted-foreground)] transition-transform duration-200 ${isOpen ? "rotate-180 text-[var(--color-accent)]" : ""
            }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-[var(--color-card)] border border-[var(--color-border)] shadow-2xl p-4 z-50 animate-fade-in space-y-4">
          {/* Header Thông tin người dùng */}
          <div className="flex items-center gap-3 pb-3 border-b border-[var(--color-border)]">
            <div className="w-10 h-10 rounded-full bg-[var(--color-secondary)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-display text-sm font-bold text-[var(--color-foreground)] truncate">
                Khách đọc truyện
              </h4>
              <p className="font-ui text-xs text-[var(--color-muted-foreground)] truncate">
                guest@storyverse.local
              </p>
            </div>
          </div>

          {/* 1. Bộ chuyển đổi Giao diện (Theme Selector) */}
          <div className="space-y-2">
            <label className="font-ui text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Giao Diện
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {themes.map(({ id, label, icon: Icon }) => {
                const isActive = settings.theme === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setTheme(id);
                      setIsOpen(false);
                    }}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-ui transition-all cursor-pointer min-h-[44px] ${isActive
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-semibold shadow-xs"
                      : "border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-muted)] text-[var(--color-foreground)]"
                      }`}
                  >
                    <div className="flex items-center gap-1">
                      <Icon className="w-4 h-4" />
                      {isActive && <Check className="w-3 h-3 text-[var(--color-accent)]" />}
                    </div>
                    <span className="text-[11px] leading-tight text-center">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Nút Đăng nhập / Đăng ký (Mock Phase 1-2) */}
          <div className="pt-2 border-t border-[var(--color-border)]">
            <button
              onClick={() => {
                alert("Tính năng Đăng nhập tài khoản sẽ có mặt trong Phase 3.");
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-ui font-semibold transition-colors shadow-xs cursor-pointer min-h-[40px]"
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng nhập / Đăng ký</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
