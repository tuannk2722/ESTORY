// components/ui/SearchInput.tsx
"use client";

import React, { useRef, useEffect, useState } from "react";
import { Search, X } from "lucide-react";

export interface SearchInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange" | "className"
> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export default function SearchInput({
  value,
  defaultValue,
  onChange,
  onClear,
  label,
  placeholder = "Tìm kiếm...",
  autoFocus = false,
  className = "",
  disabled,
  ...inputProps
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uncontrolledHasValue, setUncontrolledHasValue] = useState(Boolean(defaultValue));
  const hasValue = value !== undefined ? Boolean(value) : uncontrolledHasValue;

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Small delay to ensure DOM is ready after mount/animation
      const timer = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  return (
    <div className={`relative ${className}`}>
      {label ? <label htmlFor={inputProps.id} className="sr-only">{label}</label> : null}
      <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        {...inputProps}
        ref={inputRef}
        type="search"
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        disabled={disabled}
        onChange={(event) => {
          if (value === undefined) setUncontrolledHasValue(Boolean(event.target.value));
          onChange?.(event.target.value);
        }}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2 text-base bg-background border border-border rounded-xl text-foreground font-ui placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 transition-colors min-h-[44px] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
      />
      {hasValue && !disabled ? (
        <button
          type="button"
          onClick={() => {
            if (value === undefined && inputRef.current) inputRef.current.value = "";
            if (value === undefined) setUncontrolledHasValue(false);
            onChange?.("");
            onClear?.();
            inputRef.current?.focus();
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer flex items-center justify-center min-h-[28px] min-w-[28px]"
          aria-label="Xóa tìm kiếm"
          title="Xóa tìm kiếm"
        >
          <X aria-hidden="true" className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  );
}
