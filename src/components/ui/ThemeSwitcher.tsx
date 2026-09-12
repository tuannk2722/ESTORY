"use client";

import { Coffee, Check, Moon, Sun } from "lucide-react";
import { useReaderSettings } from "./ThemeProvider";

const themes = [
  { id: "dark", label: "Dark OLED", shortLabel: "Tối", icon: Moon },
  { id: "light", label: "Paper Light", shortLabel: "Sáng", icon: Sun },
  { id: "sepia", label: "Sepia Warm", shortLabel: "Sepia", icon: Coffee },
] as const;

export default function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { settings, setTheme } = useReaderSettings();
  const activeTheme = themes.find((theme) => theme.id === settings.theme) ?? themes[0];
  const nextTheme = themes[(themes.indexOf(activeTheme) + 1) % themes.length];

  if (compact) {
    const Icon = activeTheme.icon;
    return (
      <button
        type="button"
        onClick={() => setTheme(nextTheme.id)}
        aria-label={`Giao diện hiện tại: ${activeTheme.label}. Chuyển sang ${nextTheme.label}`}
        title={`Giao diện: ${activeTheme.label}`}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-2 text-[var(--color-foreground)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-muted)] motion-reduce:transition-none sm:px-3"
      >
        <Icon aria-hidden="true" className="h-4 w-4 text-[var(--color-accent)]" />
        <span className="hidden text-xs font-semibold md:inline">Giao diện</span>
      </button>
    );
  }

  return (
    <fieldset className="space-y-2">
      <legend className="font-ui text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        Giao diện
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {themes.map(({ id, label, shortLabel, icon: Icon }) => {
          const isActive = settings.theme === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              aria-label={`Dùng giao diện ${label}`}
              aria-pressed={isActive}
              data-profile-autofocus={isActive ? "true" : undefined}
              className={`flex min-h-[52px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-ui transition-colors motion-reduce:transition-none ${isActive
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 font-semibold text-[var(--color-accent)]"
                  : "border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
                }`}
            >
              <span className="flex items-center gap-1">
                <Icon aria-hidden="true" className="h-4 w-4" />
                {isActive ? <Check aria-hidden="true" className="h-3 w-3" /> : null}
              </span>
              <span>{shortLabel}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
