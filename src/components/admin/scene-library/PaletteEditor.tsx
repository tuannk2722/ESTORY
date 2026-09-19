"use client";

import { AlertTriangle, LoaderCircle, Save } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { ManagedColorPalette } from "@/types/scene-catalog-admin";
import SceneCatalogPreview from "./SceneCatalogPreview";
import {
  CatalogErrorSummary,
  CatalogInlineError,
  SceneCatalogDrawerShell,
  catalogFieldErrors,
  type CatalogFieldError,
} from "./SceneCatalogFormParts";
import { createPalette, updatePalette } from "./sceneCatalogTransport";

interface PaletteFormState {
  label: string;
  moodTags: string;
  primary: string;
  secondary: string;
  accent: string;
  tint: string;
  opacity: number;
}
function initialState(item?: ManagedColorPalette): PaletteFormState {
  return {
    label: item?.label ?? "",
    moodTags: item?.mood_tags.join(", ") ?? "",
    primary: item?.colors.primary ?? "#8B5CF6",
    secondary: item?.colors.secondary ?? "#0EA5E9",
    accent: item?.colors.accent ?? "#F59E0B",
    tint: item?.colors.background_tint.color ?? "#0F172A",
    opacity: item?.colors.background_tint.opacity ?? 0.4,
  };
}

function parseMoodTags(value: string): string[] {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function cssRgb(value: string): { rgb: [number, number, number]; alpha: number } | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (match) {
    const hex = match[1].length === 3
      ? match[1].split("").map((part) => `${part}${part}`).join("")
      : match[1];
    return {
      rgb: [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as [number, number, number],
      alpha: 1,
    };
  }
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?))?\s*\)$/i.exec(value.trim());
  if (!rgb) return null;
  const channels = rgb.slice(1, 4).map(Number);
  const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
  if (channels.some((channel) => channel < 0 || channel > 255) || alpha < 0 || alpha > 1) return null;
  return { rgb: channels as [number, number, number], alpha };
}

function pickerHex(value: string): string {
  const color = cssRgb(value);
  return color
    ? `#${color.rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`
    : "#000000";
}

function luminance(rgb: [number, number, number]): number {
  const values = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function bodyContrast(tint: string, opacity: number): number | null {
  const foreground = cssRgb("#F8FAFC");
  const background = cssRgb("#020617");
  const overlay = cssRgb(tint);
  if (!foreground || !background || !overlay) return null;
  const effectiveOpacity = opacity * overlay.alpha;
  const composite = background.rgb.map((channel, index) =>
    Math.round(overlay.rgb[index] * effectiveOpacity + channel * (1 - effectiveOpacity))) as [number, number, number];
  return contrast(foreground.rgb, composite);
}

const fieldClass = "mt-1.5 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm disabled:opacity-60";

function ColorField({
  id,
  label,
  value,
  onChange,
  disabled,
  errors,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  errors: CatalogFieldError[];
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <div className="mt-1.5 grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2">
        <input
          type="color"
          aria-label={`${label}, bộ chọn màu`}
          value={pickerHex(value)}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          disabled={disabled}
          className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-transparent p-1 disabled:opacity-60"
        />
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          spellCheck={false}
          aria-invalid={errors.some((error) => error.id === id)}
          className="min-h-11 min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 font-mono text-sm uppercase disabled:opacity-60"
        />
      </div>
      <CatalogInlineError id={id} errors={errors} />
    </div>
  );
}

export default function PaletteEditor({
  item,
  onClose,
  onSaved,
}: {
  item?: ManagedColorPalette;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const initial = useMemo(() => initialState(item), [item]);
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<CatalogFieldError[]>([]);
  const summaryRef = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const colors = useMemo(() => ({
    primary: form.primary,
    secondary: form.secondary,
    accent: form.accent,
    background_tint: { color: form.tint, opacity: form.opacity },
  }), [form]);
  const contrastRatio = bodyContrast(form.tint, form.opacity);

  const set = <K extends keyof PaletteFormState>(key: K, value: PaletteFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const focusErrors = (next: CatalogFieldError[]) => {
    setErrors(next);
    if (next.length) requestAnimationFrame(() => summaryRef.current?.focus());
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const validation: CatalogFieldError[] = [];
    if (!form.label.trim()) validation.push({ id: "catalog-label", message: "Tên hiển thị không được để trống." });
    if (form.opacity < 0 || form.opacity > 1) validation.push({ id: "palette-opacity", message: "Opacity phải nằm trong khoảng 0 đến 1." });
    focusErrors(validation);
    if (validation.length) return;
    setPending(true);
    try {
      const write = { label: form.label.trim(), moodTags: parseMoodTags(form.moodTags), colors };
      if (item) await updatePalette(item.id, { ...write, expectedUpdatedAt: item.updated_at });
      else await createPalette(write);
      toast.success(item ? "Đã cập nhật bảng màu." : "Đã tạo bảng màu nháp.");
      await onSaved();
      onClose();
    } catch (error) {
      focusErrors(catalogFieldErrors(error, "catalog-general"));
    } finally {
      setPending(false);
    }
  };

  return (
    <SceneCatalogDrawerShell
      title={item?.label ?? "Bảng màu mới"}
      kicker={item ? "Chỉnh sửa Palette" : "Tạo Palette nháp"}
      dirty={dirty}
      pending={pending}
      onClose={onClose}
      footer={(
        <button form="palette-editor-form" type="submit" disabled={pending || !dirty} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" className="h-4 w-4" />}
          {pending ? "Đang lưu…" : "Lưu nháp"}
        </button>
      )}
    >
      <form id="palette-editor-form" onSubmit={save} noValidate className="space-y-6">
        <CatalogErrorSummary errors={errors} summaryRef={summaryRef} />
        <div>
          <label htmlFor="catalog-label" className="text-sm font-semibold">Tên hiển thị</label>
          <input id="catalog-label" value={form.label} onChange={(event) => set("label", event.target.value)} maxLength={120} disabled={pending} className={fieldClass} />
          <CatalogInlineError id="catalog-label" errors={errors} />
        </div>
        <div>
          <label htmlFor="catalog-mood-tags" className="text-sm font-semibold">Mood tags</label>
          <input id="catalog-mood-tags" value={form.moodTags} onChange={(event) => set("moodTags", event.target.value)} disabled={pending} placeholder="ấm áp, hoàng hôn" className={fieldClass} />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">Phân tách bằng dấu phẩy, tối đa 20 tag.</p>
        </div>

        <fieldset className="grid gap-4 rounded-2xl border border-[var(--color-border)] p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-bold">Bốn kênh màu</legend>
          <ColorField id="palette-primary" label="Primary" value={form.primary} onChange={(value) => set("primary", value)} disabled={pending} errors={errors} />
          <ColorField id="palette-secondary" label="Secondary" value={form.secondary} onChange={(value) => set("secondary", value)} disabled={pending} errors={errors} />
          <ColorField id="palette-accent" label="Accent" value={form.accent} onChange={(value) => set("accent", value)} disabled={pending} errors={errors} />
          <ColorField id="palette-tint" label="Background tint" value={form.tint} onChange={(value) => set("tint", value)} disabled={pending} errors={errors} />
          <div className="sm:col-span-2">
            <label htmlFor="palette-opacity" className="text-sm font-semibold">Tint opacity</label>
            <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-3">
              <input type="range" min="0" max="1" step="0.01" value={form.opacity} onChange={(event) => set("opacity", Number(event.target.value))} disabled={pending} className="h-11 w-full accent-[var(--color-primary)]" />
              <input id="palette-opacity" type="number" min="0" max="1" step="0.01" value={form.opacity} onChange={(event) => set("opacity", Number(event.target.value))} disabled={pending} className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-2 text-sm" />
            </div>
            <CatalogInlineError id="palette-opacity" errors={errors} />
          </div>
        </fieldset>

        {contrastRatio === null || contrastRatio < 4.5 ? (
          <div role="status" className="flex gap-3 rounded-2xl border border-[var(--color-warning)]/55 bg-[var(--color-warning)]/10 p-4 text-sm">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-warning)]" />
            <p><strong>Cảnh báo tương phản.</strong> {contrastRatio === null ? "Không thể tính tự động từ định dạng màu hiện tại; hãy kiểm tra bản Preview." : `Tỷ lệ chữ truyện trên lớp tint hiện khoảng ${contrastRatio.toFixed(2)}:1, thấp hơn mức AA 4.5:1.`} Cảnh báo này không tự đổi màu và không chặn lưu.</p>
          </div>
        ) : (
          <p role="status" className="text-xs font-semibold text-emerald-500">Tương phản chữ truyện ước tính {contrastRatio.toFixed(2)}:1 (AA).</p>
        )}

        <SceneCatalogPreview palette={colors} label="Xem trước Palette" />
      </form>
    </SceneCatalogDrawerShell>
  );
}
