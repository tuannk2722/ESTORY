// components/ui/SearchableCombobox.tsx
// Dropdown combobox tái sử dụng với ô tìm kiếm bên trong, hỗ trợ cả Single-select và Multi-select
// Tuân thủ docs/04-ui-ux-design.md: bg-card, border-border, rounded-xl, font-ui, min-h-[44px], cursor-pointer, focus-visible:outline-ring
"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { matchesSearch } from "./SearchInput";
import type { LucideIcon } from "lucide-react";

export interface ComboboxOption {
  id: string;
  label: string;
  description?: string;
  /** Các giá trị text dùng để fuzzy search (label luôn được search tự động) */
  searchTexts?: string[];
  /** Icon hiển thị bên trái option */
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  /** Custom render cho option trong dropdown list */
  renderOption?: (isSelected: boolean) => React.ReactNode;
  /** Custom render cho trigger button khi option này đang được chọn (single select) */
  renderSelected?: () => React.ReactNode;
}

export interface SearchableComboboxProps {
  /** Label hiển thị phía trên trigger */
  label?: string;
  /** Icon hiển thị bên trái trigger */
  icon?: LucideIcon;
  /** Danh sách lựa chọn */
  options: ComboboxOption[];
  /** ID option đang được chọn (dành cho Single-select) */
  value?: string;
  /** Callback khi chọn option (dành cho Single-select) */
  onSelect?: (id: string) => void;
  /** Chế độ chọn nhiều (Multi-select) */
  multiple?: boolean;
  /** Danh sách ID đang được chọn (dành cho Multi-select) */
  values?: string[];
  /** Callback toggle chọn/bỏ chọn option (dành cho Multi-select) */
  onToggleSelect?: (id: string) => void;
  /** Placeholder khi chưa chọn */
  placeholder?: string;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Custom className cho container */
  className?: string;
}

export default function SearchableCombobox({
  label,
  icon: LabelIcon,
  options,
  value,
  onSelect,
  multiple = false,
  values = [],
  onToggleSelect,
  placeholder = "Chọn...",
  searchPlaceholder = "Tìm kiếm...",
  className = "",
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Click outside → close dropdown
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Keyboard: Escape closes
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  const filteredOptions = options.filter((o) =>
    matchesSearch(searchQuery, o.label, ...(o.searchTexts || []))
  );

  // Single select handler
  const handleSingleSelect = (id: string) => {
    if (onSelect) onSelect(id);
    setIsOpen(false);
    setSearchQuery("");
  };

  // Multi select handler
  const handleMultiToggle = (id: string) => {
    if (onToggleSelect) onToggleSelect(id);
  };

  const selectedSingleOption = options.find((o) => o.id === value);
  const selectedMultiOptions = options.filter((o) => values.includes(o.id));

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      {/* Label (chỉ hiển thị khi có label) */}
      {label && label.trim() !== "" && (
        <div className="flex items-center justify-between mb-1.5 font-ui">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            {LabelIcon && <LabelIcon className="w-3.5 h-3.5 text-primary" />}
            {label}
          </label>
          {multiple && values.length > 0 && (
            <span className="text-[11px] font-mono text-primary font-bold">
              {values.length} đã chọn
            </span>
          )}
        </div>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm bg-background border rounded-xl font-ui transition-all cursor-pointer min-h-[44px] text-left ${isOpen
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50"
          }`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="flex-1 truncate">
          {!multiple ? (
            selectedSingleOption ? (
              selectedSingleOption.renderSelected ? (
                selectedSingleOption.renderSelected()
              ) : (
                <span className="text-foreground font-medium">{selectedSingleOption.label}</span>
              )
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )
          ) : (
            selectedMultiOptions.length > 0 ? (
              <div className="flex flex-wrap gap-1 items-center">
                {selectedMultiOptions.map((opt) => (
                  <span
                    key={opt.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 text-xs font-medium"
                  >
                    {opt.icon && <opt.icon className="w-3 h-3 shrink-0" />}
                    <span className="truncate max-w-[120px]">{opt.label}</span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""
            }`}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 min-w-full w-max max-w-xs md:max-w-sm mt-1.5 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in">
          {/* Search Input inside dropdown */}
          <div className="p-2 border-b border-border/60">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 text-sm bg-secondary/40 border border-border/50 rounded-lg text-foreground font-ui placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1 transition-colors"
              />
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-[240px] overflow-y-auto custom-scrollbar" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground font-ui">
                Không tìm thấy kết quả
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = multiple
                  ? values.includes(option.id)
                  : option.id === value;
                const OptionIcon = option.icon;

                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    title={option.description || option.label}
                    onClick={() => {
                      if (multiple) {
                        handleMultiToggle(option.id);
                      } else {
                        handleSingleSelect(option.id);
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-ui text-left cursor-pointer transition-colors min-h-[42px] ${isSelected
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground hover:bg-secondary/60"
                      }`}
                  >
                    {option.renderOption ? (
                      option.renderOption(isSelected)
                    ) : (
                      <>
                        {OptionIcon && (
                          <OptionIcon
                            className={`w-4 h-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"
                              }`}
                          />
                        )}
                        <span className="flex-1 truncate">{option.label}</span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary shrink-0 stroke-[2.5]" />
                        )}
                      </>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Multi-select bottom action bar */}
          {multiple && (
            <div className="p-2 border-t border-border/60 bg-secondary/30 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-ui">
                {values.length} hiệu ứng đã chọn
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSearchQuery("");
                }}
                className="px-3 py-1 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground font-ui text-xs font-semibold cursor-pointer transition-colors"
              >
                Xong
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
