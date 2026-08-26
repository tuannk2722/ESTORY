// components/ui/SearchInput.tsx
// Component ô tìm kiếm tái sử dụng cho nhiều modal (ScenePicker, EffectPicker, v.v.)
"use client";

import React, { useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

// ── Normalization helpers (tái sử dụng cho mọi nơi cần fuzzy search tiếng Việt) ──

/** Chuẩn hóa chuỗi tiếng Việt: bỏ dấu, đ→d, lowercase, loại bỏ ký tự đặc biệt */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Kiểm tra query có khớp với bất kỳ giá trị nào trong mảng không (fuzzy token match) */
export function matchesSearch(query: string, ...values: string[]): boolean {
  if (!query) return true;

  const normalizedQuery = normalizeSearchText(query);
  const searchableText = normalizeSearchText(values.join(" "));
  const queryTokens = normalizedQuery.split(" ");

  return (
    queryTokens.every((token) => searchableText.includes(token)) ||
    (normalizedQuery.replaceAll(" ", "") !== "" &&
      searchableText
        .replaceAll(" ", "")
        .includes(normalizedQuery.replaceAll(" ", "")))
  );
}

// ── SearchInput Component ──

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "Tìm kiếm...",
  autoFocus = false,
  className = "",
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Small delay to ensure DOM is ready after mount/animation
      const timer = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2.5 text-sm bg-background border border-border rounded-xl text-foreground font-ui placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 transition-colors min-h-[44px] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer flex items-center justify-center min-h-[28px] min-w-[28px]"
          aria-label="Xóa tìm kiếm"
          title="Xóa tìm kiếm"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
