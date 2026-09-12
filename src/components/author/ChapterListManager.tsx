"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  FilePenLine,
  GripVertical,
  Layers3,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useConfirm } from "@/components/ui/ConfirmModal";
import InsertGapButton from "@/components/ui/InsertGapButton";
import { moveListItem, useListReorder } from "@/hooks/useListReorder";
import type { StoryStatus } from "@/types/story";
import type { ManagedChapter } from "@/types/story-management";
import type { ChapterFieldErrors, ChapterManagerActions, WizardChapter } from "./types";

interface WizardProps {
  mode: "wizard";
  chapters: WizardChapter[];
  errors?: ChapterFieldErrors;
  disabled?: boolean;
  onChange(chapters: WizardChapter[]): void;
}

interface ManageProps {
  mode: "manage";
  storyId: string;
  storyStatus: StoryStatus;
  chapters: ManagedChapter[];
  disabled?: boolean;
  busy?: boolean;
  actions: ChapterManagerActions;
}

type ChapterListManagerProps = WizardProps | ManageProps;

function DropIndicator({ active }: { active: boolean }) {
  return (
    <li aria-hidden="true" className="relative h-0 list-none">
      <span
        className={`pointer-events-none absolute inset-x-2 top-0 z-10 h-1 -translate-y-1/2 rounded-full bg-[var(--color-primary)] shadow-[0_0_10px_rgba(0,0,0,0.15)] transition-[opacity,transform] motion-reduce:transition-none ${active ? "scale-x-100 opacity-100" : "scale-x-95 opacity-0"}`}
      />
    </li>
  );
}

const ADD_CHAPTER_BUTTON_CLASS = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 hover:text-[var(--color-primary)] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none";

type ManagedInsertionTarget =
  | { kind: "after"; chapterId: string }
  | { kind: "end" };

function insertionTriggerId(target: ManagedInsertionTarget) {
  return target.kind === "after"
    ? `add-chapter-after-${target.chapterId}`
    : "add-chapter-at-end";
}

interface ChapterInsertionFormProps {
  inputId: string;
  busy: boolean;
  onCreate(title: string): Promise<void>;
  onCancel(): void;
}

function ChapterInsertionForm({
  inputId,
  busy,
  onCreate,
  onCancel,
}: ChapterInsertionFormProps) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorId = `${inputId}-error`;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) return setError("Vui lòng nhập tên chương.");
    setError(null);
    await onCreate(nextTitle);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onCancel();
  };

  return (
    <form
      data-chapter-insertion-form
      onSubmit={submit}
      onKeyDown={handleKeyDown}
      className="rounded-2xl border border-[var(--color-primary)]/40 bg-[var(--color-card)] p-4 shadow-sm"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Chương mới
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          autoFocus
          id={inputId}
          value={title}
          disabled={busy}
          onChange={(event) => { setTitle(event.target.value); setError(null); }}
          className={`min-h-11 min-w-0 flex-1 rounded-xl border bg-[var(--color-background)] px-3.5 py-2 text-sm ${error ? "border-[var(--color-destructive)]" : "border-[var(--color-border)]"}`}
          placeholder="Tên chương"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        <button type="submit" disabled={busy} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none">
          {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Plus aria-hidden="true" className="h-4 w-4" />} Thêm
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none">
          Hủy
        </button>
      </div>
      {error ? <p id={errorId} role="alert" className="mt-2 text-sm text-[var(--color-destructive)]">{error}</p> : null}
    </form>
  );
}

function WizardChapterList({ chapters, errors = {}, disabled = false, onChange }: Omit<WizardProps, "mode">) {
  const nextId = useRef(chapters.length + 1);
  const pendingFocusId = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const move = useCallback((from: number, to: number) => {
    const next = moveListItem(chapters, from, to);
    if (next === chapters) return;
    onChange(next);
    setAnnouncement(`${next[to].title.trim() || `Chương ${to + 1}`} đã chuyển tới vị trí ${to + 1}.`);
  }, [chapters, onChange]);

  const reorder = useListReorder({ itemCount: chapters.length, onMove: move });

  useEffect(() => {
    const clientId = pendingFocusId.current;
    if (!clientId) return;
    pendingFocusId.current = null;
    const frame = requestAnimationFrame(() => document.getElementById(`wizard-${clientId}-title`)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [chapters]);

  const insertAfter = (index: number) => {
    const clientId = `chapter-${Date.now()}-${nextId.current++}`;
    const next = [...chapters];
    next.splice(index + 1, 0, { clientId, title: "" });
    pendingFocusId.current = clientId;
    onChange(next);
    setAnnouncement(`Đã thêm chương tại vị trí ${index + 2}.`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Chỉ cần đặt tên chương ở bước này. Bạn sẽ viết nội dung, hiệu ứng và bối cảnh sau khi lưu truyện.
      </p>
      {errors.chapters ? <p id="chapters-error" role="alert" className="text-sm text-[var(--color-destructive)]">{errors.chapters}</p> : null}
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <ol className="space-y-1" aria-label="Danh sách chương" onDrop={reorder.handleDrop}>
        {chapters.map((chapter, index) => {
          const error = errors[chapter.clientId];
          const inputId = `wizard-${chapter.clientId}-title`;
          const indicatorBefore = reorder.dropTarget?.index === index && reorder.dropTarget.position === "before";
          const indicatorAfter = reorder.dropTarget?.index === index && reorder.dropTarget.position === "after";
          return (
            <Fragment key={chapter.clientId}>
              <DropIndicator active={indicatorBefore} />
              <li
                data-reorder-item
                className={`rounded-2xl border bg-[var(--color-card)] p-3 transition-[border-color,opacity] motion-reduce:transition-none ${reorder.draggedIndex === index ? "border-[var(--color-ring)] opacity-65" : "border-[var(--color-border)]"}`}
                onDragOver={(event) => reorder.handleDragOver(event, index)}
              >
                <div className="flex items-start gap-2">
                  <span
                    data-reorder-handle
                    draggable={!disabled}
                    onMouseDown={() => reorder.setDragHandleActive(true)}
                    onTouchStart={() => reorder.setDragHandleActive(true)}
                    onDragStart={(event) => reorder.handleDragStart(event, index)}
                    onDragEnd={reorder.handleDragEnd}
                    className="mt-0.5 hidden min-h-11 min-w-11 select-none cursor-grab items-center justify-center text-[var(--color-muted-foreground)] active:cursor-grabbing lg:flex"
                    title="Kéo để sắp xếp"
                    aria-hidden="true"
                  >
                    <GripVertical className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Chương {index + 1}</label>
                    <input
                      id={inputId}
                      value={chapter.title}
                      disabled={disabled}
                      onChange={(event) => onChange(chapters.map((item) => item.clientId === chapter.clientId ? { ...item, title: event.target.value } : item))}
                      className={`min-h-11 w-full rounded-xl border bg-[var(--color-background)] px-3.5 py-2 text-sm ${error ? "border-[var(--color-destructive)]" : "border-[var(--color-border)]"}`}
                      placeholder="Tên chương"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `${inputId}-error` : undefined}
                    />
                    {error ? <p id={`${inputId}-error`} role="alert" className="text-sm text-[var(--color-destructive)]">{error}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:gap-2">
                    <button type="button" disabled={disabled || index === 0} onClick={() => reorder.moveUp(index)} className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:pointer-events-none disabled:opacity-35" aria-label={`Chuyển chương ${index + 1} lên`}>
                      <ArrowUp aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={disabled || index === chapters.length - 1} onClick={() => reorder.moveDown(index)} className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:pointer-events-none disabled:opacity-35" aria-label={`Chuyển chương ${index + 1} xuống`}>
                      <ArrowDown aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={disabled || chapters.length === 1}
                      onClick={() => {
                        pendingFocusId.current = chapters[index + 1]?.clientId
                          ?? chapters[index - 1]?.clientId
                          ?? null;
                        onChange(chapters.filter((item) => item.clientId !== chapter.clientId));
                        setAnnouncement(`Đã xóa chương ${index + 1}.`);
                      }}
                      className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl text-[var(--color-muted-foreground)] hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)] disabled:pointer-events-none disabled:opacity-35"
                      aria-label={`Xóa chương ${index + 1}`}
                      title={chapters.length === 1 ? "Mỗi truyện cần ít nhất một chương" : "Xóa chương"}
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
              <DropIndicator active={indicatorAfter} />
              {index < chapters.length - 1 ? (
                <li
                  data-reorder-gap
                  className="list-none"
                  onDragOver={(event) => reorder.handleDragOverAt(event, index, "after")}
                >
                  {reorder.draggedIndex === null ? (
                    <InsertGapButton
                      label="Thêm chương"
                      ariaLabel={`Thêm chương sau chương ${index + 1}`}
                      disabled={disabled}
                      onClick={() => insertAfter(index)}
                    />
                  ) : <div aria-hidden="true" className="min-h-11" />}
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
      <button type="button" disabled={disabled} onClick={() => insertAfter(chapters.length - 1)} className={ADD_CHAPTER_BUTTON_CLASS}>
        <Plus aria-hidden="true" className="h-4 w-4" /> Thêm chương
      </button>
    </div>
  );
}

interface ManagedRowProps {
  chapter: ManagedChapter;
  index: number;
  chapterCount: number;
  publishedCount: number;
  storyId: string;
  storyStatus: StoryStatus;
  readOnly: boolean;
  busy: boolean;
  dragging: boolean;
  onMoveUp(): void;
  onMoveDown(): void;
  onDragHandleActive(): void;
  onDragStart(event: DragEvent<HTMLElement>): void;
  onDragEnd(): void;
  onDragOver(event: DragEvent<HTMLLIElement>): void;
  onDelete(): Promise<void>;
  actions: ChapterManagerActions;
}

function ManagedChapterRow({
  chapter,
  index,
  chapterCount,
  publishedCount,
  storyId,
  storyStatus,
  readOnly,
  busy,
  dragging,
  onMoveUp,
  onMoveDown,
  onDragHandleActive,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDelete,
  actions,
}: ManagedRowProps) {
  const confirm = useConfirm();
  const [title, setTitle] = useState(chapter.title);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [sourceTitle, setSourceTitle] = useState(chapter.title);
  const lastPublished = storyStatus === "published" && chapter.status === "published" && publishedCount === 1;
  const cannotDelete = chapterCount === 1;
  const inputId = `manage-${chapter.id}-title`;

  if (chapter.title !== sourceTitle) {
    setSourceTitle(chapter.title);
    setTitle(chapter.title);
    setTitleError(null);
  }

  const saveTitle = () => {
    const next = title.trim();
    if (!next) return setTitleError("Vui lòng nhập tên chương.");
    setTitleError(null);
    void actions.onRename(chapter.id, next);
  };

  const remove = async () => {
    if (chapter.blockCount > 0) {
      const accepted = await confirm({
        title: `Xóa “${chapter.title}”?`,
        description: "Nội dung, hiệu ứng và bối cảnh trong chương sẽ bị xóa. Hành động này không thể hoàn tác.",
        confirmText: "Xóa chương",
        variant: "danger",
      });
      if (!accepted) return;
    }
    await onDelete();
  };

  return (
    <li
      data-reorder-item
      className={`rounded-2xl border bg-[var(--color-card)] p-4 transition-[border-color,opacity] motion-reduce:transition-none ${dragging ? "border-[var(--color-ring)] opacity-65" : "border-[var(--color-border)]"}`}
      onDragOver={onDragOver}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2">
          <span
            data-reorder-handle
            draggable={!readOnly && !busy}
            onMouseDown={onDragHandleActive}
            onTouchStart={onDragHandleActive}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className="mt-0.5 hidden min-h-11 min-w-11 select-none cursor-grab items-center justify-center text-[var(--color-muted-foreground)] active:cursor-grabbing lg:flex"
            title="Kéo để sắp xếp"
            aria-hidden="true"
          >
            <GripVertical className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Chương {index + 1}</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id={inputId}
                value={title}
                disabled={readOnly || busy}
                onChange={(event) => { setTitle(event.target.value); setTitleError(null); }}
                className={`min-h-11 min-w-0 flex-1 rounded-xl border bg-[var(--color-background)] px-3.5 py-2 text-sm disabled:cursor-not-allowed ${titleError ? "border-[var(--color-destructive)]" : "border-[var(--color-border)]"}`}
                aria-invalid={Boolean(titleError)}
                aria-describedby={titleError ? `${inputId}-error` : undefined}
              />
              <button type="button" disabled={readOnly || busy || title.trim() === chapter.title || !title.trim()} onClick={saveTitle} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-secondary)] disabled:pointer-events-none disabled:opacity-40">
                <Save aria-hidden="true" className="h-4 w-4" /> Lưu tên
              </button>
            </div>
            {titleError ? <p id={`${inputId}-error`} role="alert" className="text-sm text-[var(--color-destructive)]">{titleError}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--color-muted-foreground)]">
          <span className="inline-flex items-center gap-1.5"><Layers3 aria-hidden="true" className="h-4 w-4" /> {chapter.blockCount} block</span>
          <span className="inline-flex items-center gap-1.5"><Sparkles aria-hidden="true" className="h-4 w-4" /> {chapter.effectCount} hiệu ứng</span>
          <span className={`rounded-full border px-2.5 py-1 font-semibold ${chapter.status === "published" ? "border-[var(--color-success)]/30 text-[var(--color-success)]" : "border-[var(--color-border)]"}`}>
            {chapter.status === "published" ? "Đã publish" : "Bản nháp"}
          </span>
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3 sm:flex-row sm:flex-wrap sm:items-center">
          {readOnly ? (
            <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 text-sm text-[var(--color-muted-foreground)]" aria-disabled="true">
              <FilePenLine aria-hidden="true" className="h-4 w-4" /> Chỉ đọc
            </span>
          ) : (
            <Link href={`/author/stories/${encodeURIComponent(storyId)}/${encodeURIComponent(chapter.id)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-editor-action)] px-4 text-sm font-semibold text-[var(--color-editor-action-foreground)] transition-colors hover:bg-[var(--color-editor-action-hover)]">
              <FilePenLine aria-hidden="true" className="h-4 w-4" /> Sửa nội dung
            </Link>
          )}

          <button
            type="button"
            role="switch"
            aria-checked={chapter.status === "published"}
            aria-label={`${chapter.status === "published" ? "Gỡ publish" : "Publish"} ${chapter.title}`}
            disabled={readOnly || busy || lastPublished}
            onClick={() => void actions.onTogglePublication(chapter)}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm font-semibold transition-colors hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            title={lastPublished ? "Truyện đang xuất bản phải giữ ít nhất một chương hiển thị" : undefined}
          >
            <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full border transition-colors motion-reduce:transition-none ${chapter.status === "published" ? "border-[var(--color-success)] bg-[var(--color-success)]" : "border-[var(--color-border)] bg-[var(--color-muted)]"}`}>
              <span className={`absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${chapter.status === "published" ? "translate-x-5" : "translate-x-0"}`} />
            </span>
            <span>Publish chương</span>
          </button>

          <div className="flex gap-2 sm:ml-auto">
            <button type="button" disabled={readOnly || busy || index === 0} onClick={onMoveUp} className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:pointer-events-none disabled:opacity-35" aria-label={`Chuyển ${chapter.title} lên`}>
              <ArrowUp aria-hidden="true" className="h-4 w-4" />
            </button>
            <button type="button" disabled={readOnly || busy || index === chapterCount - 1} onClick={onMoveDown} className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:pointer-events-none disabled:opacity-35" aria-label={`Chuyển ${chapter.title} xuống`}>
              <ArrowDown aria-hidden="true" className="h-4 w-4" />
            </button>
            <button type="button" disabled={readOnly || busy || cannotDelete} onClick={() => void remove()} className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl text-[var(--color-muted-foreground)] hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)] disabled:cursor-not-allowed disabled:opacity-35" aria-label={`Xóa ${chapter.title}`} title={cannotDelete ? "Mỗi truyện cần ít nhất một chương" : "Xóa chương"}>
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
        {lastPublished ? <p className="text-xs text-[var(--color-warning)]">Không thể gỡ chương published cuối cùng khi truyện đang công khai.</p> : null}
        {cannotDelete ? <p className="text-xs text-[var(--color-muted-foreground)]">Mỗi truyện phải giữ lại ít nhất một chương.</p> : null}
      </div>
    </li>
  );
}

function ManagedChapterList({ storyId, storyStatus, chapters, disabled = false, busy = false, actions }: Omit<ManageProps, "mode">) {
  const ordered = useMemo(() => [...chapters].sort((left, right) => left.order - right.order), [chapters]);
  const pendingFocusId = useRef<string | null>(null);
  const insertionTrigger = useRef<string | null>(null);
  const [insertionTarget, setInsertionTarget] = useState<ManagedInsertionTarget | null>(null);
  const readOnly = disabled || storyStatus === "pending_review" || storyStatus === "archived";
  const publishedCount = ordered.filter((chapter) => chapter.status === "published").length;

  const move = useCallback((from: number, to: number) => {
    const next = moveListItem(ordered, from, to);
    if (next === ordered) return;
    void actions.onReorder(next.map((chapter) => chapter.id));
  }, [actions, ordered]);
  const reorder = useListReorder({ itemCount: ordered.length, onMove: move });

  useEffect(() => {
    const chapterId = pendingFocusId.current;
    if (chapterId) {
      pendingFocusId.current = null;
      const frame = requestAnimationFrame(() => document.getElementById(`manage-${chapterId}-title`)?.focus());
      return () => cancelAnimationFrame(frame);
    }
    const triggerId = insertionTrigger.current;
    if (triggerId && insertionTarget === null) {
      insertionTrigger.current = null;
      const frame = requestAnimationFrame(() => document.getElementById(triggerId)?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [chapters, insertionTarget]);

  const openInsertion = (target: ManagedInsertionTarget) => {
    insertionTrigger.current = insertionTriggerId(target);
    setInsertionTarget(target);
  };

  const closeInsertion = () => setInsertionTarget(null);

  const insert = async (title: string) => {
    if (!insertionTarget) return;
    const afterChapterId = insertionTarget.kind === "after" ? insertionTarget.chapterId : undefined;
    const created = await actions.onCreate(title, afterChapterId);
    if (!created) return;
    pendingFocusId.current = created.id;
    insertionTrigger.current = null;
    setInsertionTarget(null);
  };

  const deleteChapter = async (chapter: ManagedChapter, index: number) => {
    pendingFocusId.current = ordered[index + 1]?.id ?? ordered[index - 1]?.id ?? null;
    const deleted = await actions.onDelete(chapter);
    if (!deleted) {
      pendingFocusId.current = null;
      return;
    }
    if (insertionTarget?.kind === "after" && insertionTarget.chapterId === chapter.id) {
      insertionTrigger.current = null;
      setInsertionTarget(null);
    }
  };

  const insertionForm = (inputId: string) => (
    <ChapterInsertionForm
      inputId={inputId}
      busy={busy}
      onCreate={insert}
      onCancel={closeInsertion}
    />
  );

  return (
    <div className="space-y-4">
      {readOnly ? (
        <div className="rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 p-3 text-sm text-[var(--color-warning)]" role="status">
          {storyStatus === "pending_review"
            ? "Danh sách chương đang ở chế độ chỉ đọc trong thời gian truyện chờ duyệt. Hủy gửi để chỉnh sửa."
            : "Truyện đã lưu trữ đang ở chế độ chỉ đọc. Khôi phục truyện để chỉnh sửa."}
        </div>
      ) : null}
      <ol className="space-y-1" aria-label="Danh sách chương của truyện" onDrop={reorder.handleDrop}>
        {ordered.map((chapter, index) => {
          const indicatorBefore = reorder.dropTarget?.index === index && reorder.dropTarget.position === "before";
          const indicatorAfter = reorder.dropTarget?.index === index && reorder.dropTarget.position === "after";
          const insertionHere = insertionTarget?.kind === "after" && insertionTarget.chapterId === chapter.id;
          return (
            <Fragment key={chapter.id}>
              <DropIndicator active={indicatorBefore} />
              <ManagedChapterRow
                chapter={chapter}
                index={index}
                chapterCount={ordered.length}
                publishedCount={publishedCount}
                storyId={storyId}
                storyStatus={storyStatus}
                readOnly={readOnly}
                busy={busy}
                dragging={reorder.draggedIndex === index}
                actions={actions}
                onMoveUp={() => reorder.moveUp(index)}
                onMoveDown={() => reorder.moveDown(index)}
                onDragHandleActive={() => reorder.setDragHandleActive(true)}
                onDragStart={(event) => reorder.handleDragStart(event, index)}
                onDragEnd={reorder.handleDragEnd}
                onDragOver={(event) => reorder.handleDragOver(event, index)}
                onDelete={() => deleteChapter(chapter, index)}
              />
              <DropIndicator active={indicatorAfter} />
              {index < ordered.length - 1 && !readOnly ? (
                <li
                  data-reorder-gap
                  className={`list-none ${insertionHere ? "my-11" : ""}`}
                  onDragOver={(event) => reorder.handleDragOverAt(event, index, "after")}
                >
                  {insertionHere ? (
                    insertionForm(`insert-after-${chapter.id}`)
                  ) : reorder.draggedIndex === null && insertionTarget === null ? (
                    <InsertGapButton
                      id={insertionTriggerId({ kind: "after", chapterId: chapter.id })}
                      label="Thêm chương"
                      ariaLabel={`Thêm chương sau ${chapter.title}`}
                      disabled={busy}
                      onClick={() => openInsertion({ kind: "after", chapterId: chapter.id })}
                    />
                  ) : <div aria-hidden="true" className="min-h-11" />}
                </li>
              ) : null}
            </Fragment>
          );
        })}
        {insertionTarget?.kind === "end" ? (
          <li className="list-none pt-1">
            {insertionForm("insert-at-end")}
          </li>
        ) : null}
      </ol>

      {!readOnly && insertionTarget === null ? (
        <button id="add-chapter-at-end" type="button" disabled={busy} onClick={() => openInsertion({ kind: "end" })} className={ADD_CHAPTER_BUTTON_CLASS}>
          <Plus aria-hidden="true" className="h-4 w-4" /> Thêm chương
        </button>
      ) : null}
    </div>
  );
}

export default function ChapterListManager(props: ChapterListManagerProps) {
  return props.mode === "wizard"
    ? <WizardChapterList {...props} />
    : <ManagedChapterList {...props} />;
}
