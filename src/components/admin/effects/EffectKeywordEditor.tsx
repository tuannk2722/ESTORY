"use client";

import { Check, Edit3, KeyRound, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import type { useConfirm } from "@/components/ui/ConfirmModal";
import type { EffectKeywordSuggestion } from "@/types/effect-admin";
import { normalizeEffectKeyword } from "@/lib/effects/effect-keyword-normalization";
import { createEffectKeyword, deleteEffectKeyword, updateEffectKeyword, EffectAdminRequestError, type EffectAdminListItem } from "../effectAdminTransport";
import { InlineError, toFieldErrors, type FieldError } from "./EffectAdminErrors";

export default function KeywordEditor({
  effect,
  keywords,
  revision,
  disabled,
  errors,
  onKeywordsChange,
  onRevisionChange,
  onErrors,
  onDirtyChange,
  onPendingChange,
  onStale,
  confirm,
}: {
  effect: EffectAdminListItem;
  keywords: EffectKeywordSuggestion[];
  revision: string;
  disabled: boolean;
  errors: FieldError[];
  onKeywordsChange: (keywords: EffectKeywordSuggestion[]) => void;
  onRevisionChange: (revision: string) => void;
  onErrors: (errors: FieldError[]) => void;
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
  onStale: () => void;
  confirm: ReturnType<typeof useConfirm>;
}) {
  const [keyword, setKeyword] = useState("");
  const [weight, setWeight] = useState("50");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKeyword, setEditKeyword] = useState("");
  const [editWeight, setEditWeight] = useState("50");
  const [pending, setPending] = useState(false);
  useEffect(() => onPendingChange(pending), [pending, onPendingChange]);

  const draftDirty = Boolean(keyword.trim()) || weight !== "50" || editingId !== null;
  useEffect(() => onDirtyChange(draftDirty), [draftDirty, onDirtyChange]);

  const validate = (value: string, rawWeight: string, excludeId?: string): FieldError[] => {
    const fieldId = excludeId ? `edit-keyword-${excludeId}` : "new-keyword";
    const weightId = excludeId ? `edit-weight-${excludeId}` : "new-keyword-weight";
    const normalized = normalizeEffectKeyword(value);
    const parsedWeight = Number(rawWeight);
    const result: FieldError[] = [];
    if (!normalized) result.push({ id: fieldId, message: "Nhập từ khóa gợi ý." });
    if (normalized && keywords.some((item) => item.id !== excludeId && item.normalized_keyword === normalized)) {
      result.push({ id: fieldId, message: "Từ khóa này đã tồn tại sau khi chuẩn hóa Unicode." });
    }
    if (!Number.isInteger(parsedWeight) || parsedWeight < 1 || parsedWeight > 100) {
      result.push({ id: weightId, message: "Trọng số phải là số nguyên từ 1 đến 100." });
    }
    return result;
  };

  const addKeyword = async () => {
    if (disabled || pending) return;
    const errors = validate(keyword, weight);
    onErrors(errors);
    if (errors.length) return;
    setPending(true);
    try {
      const result = await createEffectKeyword(effect.id, {
        keyword: keyword.trim().replace(/\s+/g, " "),
        weight: Number(weight),
        expectedUpdatedAt: revision,
      });
      onKeywordsChange(result.data.keywords);
      if (result.meta?.updatedAt) onRevisionChange(result.meta.updatedAt);
      setKeyword("");
      setWeight("50");
      onErrors([]);
      toast.success("Đã thêm từ khóa gợi ý.");
    } catch (error) {
      if (error instanceof EffectAdminRequestError && error.code === "STALE_UPDATE") onStale();
      onErrors(toFieldErrors(error, "new-keyword"));
    } finally {
      setPending(false);
    }
  };

  const saveKeyword = async (entry: EffectKeywordSuggestion) => {
    if (disabled || pending) return;
    const errors = validate(editKeyword, editWeight, entry.id);
    onErrors(errors);
    if (errors.length) return;
    setPending(true);
    try {
      const result = await updateEffectKeyword(effect.id, {
        keywordId: entry.id,
        keyword: editKeyword.trim().replace(/\s+/g, " "),
        weight: Number(editWeight),
        expectedUpdatedAt: revision,
      });
      onKeywordsChange(result.data.keywords);
      if (result.meta?.updatedAt) onRevisionChange(result.meta.updatedAt);
      setEditingId(null);
      onErrors([]);
      toast.success("Đã cập nhật từ khóa.");
    } catch (error) {
      if (error instanceof EffectAdminRequestError && error.code === "STALE_UPDATE") onStale();
      onErrors(toFieldErrors(error, `edit-keyword-${entry.id}`));
    } finally {
      setPending(false);
    }
  };

  const removeKeyword = async (entry: EffectKeywordSuggestion) => {
    if (disabled || pending) return;
    const accepted = await confirm({
      title: `Xóa từ khóa “${entry.keyword}”?`,
      description: "Từ khóa này sẽ không còn được dùng để tìm kiếm hoặc gợi ý hiệu ứng.",
      confirmText: "Xóa từ khóa",
      cancelText: "Giữ lại",
      variant: "danger",
    });
    if (!accepted) return;
    setPending(true);
    try {
      const result = await deleteEffectKeyword(effect.id, { keywordId: entry.id, expectedUpdatedAt: revision });
      onKeywordsChange(result.data.keywords);
      if (result.meta?.updatedAt) onRevisionChange(result.meta.updatedAt);
      onErrors([]);
      toast.success("Đã xóa từ khóa.");
    } catch (error) {
      if (error instanceof EffectAdminRequestError && error.code === "STALE_UPDATE") onStale();
      onErrors(toFieldErrors(error, `keyword-${entry.id}`));
    } finally {
      setPending(false);
    }
  };

  const submitOnEnter = (event: KeyboardEvent<HTMLInputElement>, submit: () => void) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return (
    <section aria-labelledby="keyword-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound aria-hidden="true" className="h-4 w-4 text-[var(--color-primary)]" />
          <h3 id="keyword-heading" className="text-sm font-bold">Từ khóa tìm kiếm và gợi ý</h3>
          <span className="inline-flex items-center justify-center rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--color-muted-foreground)]">
            {keywords.length}
          </span>
        </div>
      </div>

      <p className="text-xs text-[var(--color-muted-foreground)]">Tìm effect theo từ khóa hoặc gợi ý từ nội dung block. Weight chỉ ưu tiên gợi ý, không xếp hạng tìm kiếm. Editor nhận thay đổi khi tải lại.</p>
      <div role="group" aria-label="Thêm từ khóa mới" className="grid gap-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-keyword" className="text-xs font-semibold text-[var(--color-foreground)]">
            Từ khóa mới
          </label>
          <input
            id="new-keyword"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => submitOnEnter(event, () => void addKeyword())}
            disabled={disabled || pending}
            maxLength={100}
            placeholder="Từ khóa…"
            aria-invalid={errors.some((e) => e.id === "new-keyword")}
            aria-describedby={errors.some((e) => e.id === "new-keyword") ? "new-keyword-error" : undefined}
            className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm disabled:opacity-60"
          />
          <InlineError id="new-keyword" errors={errors} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-keyword-weight" className="text-xs font-semibold text-[var(--color-foreground)]">
            Trọng số <span className="font-normal text-[var(--color-muted-foreground)]">(1–100)</span>
          </label>
          <input
            id="new-keyword-weight"
            type="number"
            min={1}
            max={100}
            step={1}
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            onKeyDown={(event) => submitOnEnter(event, () => void addKeyword())}
            disabled={disabled || pending}
            aria-invalid={errors.some((e) => e.id === "new-keyword-weight")}
            aria-describedby={errors.some((e) => e.id === "new-keyword-weight") ? "new-keyword-weight-error" : undefined}
            className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm disabled:opacity-60"
          />
          <InlineError id="new-keyword-weight" errors={errors} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="hidden select-none text-xs opacity-0 sm:block" aria-hidden="true">
            Thao tác
          </span>
          <button
            type="button"
            onClick={() => void addKeyword()}
            disabled={disabled || pending}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] transition-all disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <Plus aria-hidden="true" className="h-4 w-4 shrink-0" /> Thêm
          </button>
        </div>
      </div>

      {keywords.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-sm text-[var(--color-muted-foreground)]">Chưa có từ khóa gợi ý.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xs">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-muted)]/25 px-3.5 py-2 text-xs font-medium text-[var(--color-muted-foreground)]">
            <span>Danh sách từ khóa ({keywords.length})</span>
            {keywords.length > 4 && (
              <span className="text-[11px] text-[var(--color-muted-foreground)]/80">Cuộn để xem thêm</span>
            )}
          </div>
          <ul
            aria-label="Danh sách từ khóa gợi ý"
            className="divide-y divide-[var(--color-border)] max-h-72 overflow-y-auto overscroll-contain custom-scrollbar"
          >
            {keywords.map((entry) => (
              <li
                key={entry.id}
                id={`keyword-${entry.id}`}
                className={`p-3 transition-colors ${editingId === entry.id ? "bg-[var(--color-primary)]/5" : "hover:bg-[var(--color-muted)]/15"}`}
              >
                {editingId === entry.id ? (
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_auto] sm:items-start">
                    <div>
                      <label htmlFor={`edit-keyword-${entry.id}`} className="sr-only">Sửa từ khóa {entry.keyword}</label>
                      <input
                        id={`edit-keyword-${entry.id}`}
                        value={editKeyword}
                        onChange={(event) => setEditKeyword(event.target.value)}
                        onKeyDown={(event) => submitOnEnter(event, () => void saveKeyword(entry))}
                        disabled={disabled || pending}
                        aria-invalid={errors.some((e) => e.id === `edit-keyword-${entry.id}`)}
                        aria-describedby={errors.some((e) => e.id === `edit-keyword-${entry.id}`) ? `edit-keyword-${entry.id}-error` : undefined}
                        className="min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm"
                      />
                      <InlineError id={`edit-keyword-${entry.id}`} errors={errors} />
                    </div>
                    <div>
                      <label htmlFor={`edit-weight-${entry.id}`} className="sr-only">Sửa trọng số</label>
                      <input
                        id={`edit-weight-${entry.id}`}
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        value={editWeight}
                        onChange={(event) => setEditWeight(event.target.value)}
                        onKeyDown={(event) => submitOnEnter(event, () => void saveKeyword(entry))}
                        disabled={disabled || pending}
                        aria-invalid={errors.some((e) => e.id === `edit-weight-${entry.id}`)}
                        aria-describedby={errors.some((e) => e.id === `edit-weight-${entry.id}`) ? `edit-weight-${entry.id}-error` : undefined}
                        className="min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm"
                      />
                      <InlineError id={`edit-weight-${entry.id}`} errors={errors} />
                    </div>
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => void saveKeyword(entry)} disabled={disabled || pending} aria-label={`Lưu từ khóa ${entry.keyword}`} className="flex min-h-10 min-w-10 items-center justify-center rounded-xl text-[var(--color-success)] hover:bg-[var(--color-muted)]"><Check aria-hidden="true" className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setEditingId(null)} disabled={pending} aria-label="Hủy sửa từ khóa" className="flex min-h-10 min-w-10 items-center justify-center rounded-xl hover:bg-[var(--color-muted)]"><X aria-hidden="true" className="h-4 w-4" /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{entry.keyword}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">Trọng số {entry.weight}</p>
                    </div>
                    <button
                      type="button"
                      disabled={disabled || pending}
                      onClick={() => { setEditingId(entry.id); setEditKeyword(entry.keyword); setEditWeight(String(entry.weight)); }}
                      aria-label={`Sửa từ khóa ${entry.keyword}`}
                      className="flex min-h-10 min-w-10 items-center justify-center rounded-xl hover:bg-[var(--color-muted)] disabled:opacity-50"
                    ><Edit3 aria-hidden="true" className="h-4 w-4" /></button>
                    <button
                      type="button"
                      disabled={disabled || pending}
                      onClick={() => void removeKeyword(entry)}
                      aria-label={`Xóa từ khóa ${entry.keyword}`}
                      className="flex min-h-10 min-w-10 items-center justify-center rounded-xl text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 disabled:opacity-50"
                    ><Trash2 aria-hidden="true" className="h-4 w-4" /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
