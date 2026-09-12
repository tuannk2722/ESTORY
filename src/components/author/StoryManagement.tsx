"use client";

import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  Clock3,
  Loader2,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/ConfirmModal";
import type {
  ChapterOrder,
  ManagedChapter,
  ManagedStory,
  ManagedStoryData,
} from "@/types/story-management";
import { normalizeCoverPosition, sameCoverPosition } from "@/lib/story-cover";
import { AuthorRequestError, commandRequest, friendlyRequestMessage, UploadCancelledError } from "./authorTransport";
import ChapterListManager from "./ChapterListManager";
import { CoverUploadProgress } from "./CoverUploader";
import FormErrorSummary from "./FormErrorSummary";
import LiveStoryCardPreview from "./LiveStoryCardPreview";
import PublishStoryButton from "./PublishStoryButton";
import StatusBadge from "./StatusBadge";
import StoryForm from "./StoryForm";
import { isStoryMutable, validateStoryForm } from "./storyRules";
import type { ChapterManagerActions, StoryFieldErrors, StoryFormValue } from "./types";
import { useCoverUpload } from "./useCoverUpload";

interface StoryManagementProps {
  initial: ManagedStoryData;
  initialRevision: string;
}

function sameGenres(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((genre, index) => genre === right[index]);
}

function statusDescription(story: Pick<ManagedStory, "status">): string {
  switch (story.status) {
    case "draft": return "Hoàn thiện nội dung rồi gửi truyện để quản trị viên duyệt.";
    case "pending_review": return "Nội dung đang được duyệt và tạm thời ở chế độ chỉ đọc.";
    case "published": return "Truyện đang hiển thị công khai. Thay đổi đã lưu được áp dụng ngay.";
    case "rejected": return "Chỉnh sửa theo phản hồi bên dưới rồi gửi lại khi đã sẵn sàng.";
    case "archived": return "Truyện không còn hiển thị công khai và đang ở chế độ chỉ đọc.";
  }
}

function mapMetadataErrors(error: AuthorRequestError): StoryFieldErrors {
  const errors: StoryFieldErrors = {};
  for (const [path, messages] of Object.entries(error.fieldErrors ?? {})) {
    const message = messages[0];
    if (!message) continue;
    if (path === "metadata.title") errors.title = message;
    else if (path === "metadata.description") errors.description = message;
    else if (path === "metadata.genre") errors.genre = message;
    else if (path === "coverUploadId") errors.cover = message;
  }
  return errors;
}

export default function StoryManagement({ initial, initialRevision }: StoryManagementProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const summaryRef = useRef<HTMLDivElement>(null);
  const focusSummaryPendingRef = useRef(false);
  const revisionRef = useRef(initialRevision);
  const operationRef = useRef<string | null>(null);
  const [story, setStory] = useState(initial.story);
  const [rejectionReason, setRejectionReason] = useState(initial.rejectionReason);
  const [form, setForm] = useState<StoryFormValue>({
    title: initial.story.title,
    byline: initial.story.author,
    description: initial.story.description,
    genre: initial.story.genre,
    coverFile: null,
    coverPreviewUrl: null,
    coverPosition: normalizeCoverPosition(initial.story.cover_position),
    coverError: null,
  });
  const [formErrors, setFormErrors] = useState<StoryFieldErrors>({});
  const [busyOperation, setBusyOperation] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const upload = useCoverUpload();
  const formRef = useRef(form);
  const readOnly = !isStoryMutable(story);
  const metadataDirty = form.coverFile !== null
    || form.title !== story.title
    || form.description !== story.description
    || !sameCoverPosition(form.coverPosition, story.cover_position)
    || !sameGenres(form.genre, story.genre);

  useEffect(() => {
    if (!focusSummaryPendingRef.current || Object.keys(formErrors).length === 0) return;
    focusSummaryPendingRef.current = false;
    summaryRef.current?.focus();
  }, [formErrors]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => () => {
    const previewUrl = formRef.current.coverPreviewUrl;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, []);

  const focusSummary = () => { focusSummaryPendingRef.current = true; };
  const updateRevision = (updatedAt: string) => { revisionRef.current = updatedAt; };
  const announceSuccess = (message: string) => {
    toast.success(message);
    setPageError(null);
  };
  const announceFailure = (error: unknown, fallback: string) => {
    const message = friendlyRequestMessage(error, fallback);
    toast.error(message);
    setPageError(message);
  };

  const lock = async <T,>(key: string, work: () => Promise<T>): Promise<T | null> => {
    if (operationRef.current) return null;
    operationRef.current = key;
    setBusyOperation(key);
    setPageError(null);
    try {
      return await work();
    } finally {
      operationRef.current = null;
      setBusyOperation(null);
    }
  };

  const handleFormChange = (next: StoryFormValue) => {
    if (next.coverFile !== form.coverFile) upload.resetForFile(next.coverFile);
    setForm(next);
    if (Object.keys(formErrors).length > 0) {
      setFormErrors(validateStoryForm(next, { requireByline: false, hasExistingCover: Boolean(story.cover_image) }));
    }
    setPageError(null);
  };

  const saveMetadata = async (event?: FormEvent) => {
    event?.preventDefault();
    if (readOnly || operationRef.current) return;
    const errors = validateStoryForm(form, { requireByline: false, hasExistingCover: Boolean(story.cover_image) });
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return focusSummary();

    await lock("metadata", async () => {
      try {
        const coverUploadId = form.coverFile ? await upload.ensureUploaded(form.coverFile) : undefined;
        const result = await commandRequest<ManagedStory>(`/api/stories/${encodeURIComponent(story.id)}`, "PUT", {
          expectedUpdatedAt: revisionRef.current,
          ...(coverUploadId ? { coverUploadId } : {}),
          metadata: {
            title: form.title,
            description: form.description,
            genre: form.genre,
            cover_position: form.coverPosition,
          },
        });
        updateRevision(result.meta.updatedAt);
        setStory(result.data);
        if (form.coverPreviewUrl) URL.revokeObjectURL(form.coverPreviewUrl);
        setForm({
          title: result.data.title,
          byline: result.data.author,
          description: result.data.description,
          genre: result.data.genre,
          coverFile: null,
          coverPreviewUrl: null,
          coverPosition: normalizeCoverPosition(result.data.cover_position),
          coverError: null,
        });
        setFormErrors({});
        upload.clearCompleted();
        announceSuccess("Đã lưu thông tin truyện.");
      } catch (error) {
        if (error instanceof UploadCancelledError) {
          const message = "Đã hủy tải ảnh. Các thay đổi trên biểu mẫu vẫn được giữ lại.";
          toast.info(message);
          setPageError(message);
          return;
        }
        if (error instanceof AuthorRequestError && error.fieldErrors) {
          const fields = mapMetadataErrors(error);
          setFormErrors(fields);
          if (Object.keys(fields).length > 0) focusSummary();
        }
        announceFailure(error, "Không thể lưu thông tin truyện.");
      }
    });
  };

  const replaceChapter = (chapter: ManagedChapter) => {
    setStory((current) => ({
      ...current,
      chapters: current.chapters.map((candidate) => candidate.id === chapter.id ? chapter : candidate),
    }));
  };

  const runChapter = async <T,>(
    key: string,
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown>,
    apply: (data: T) => void,
    success: string,
  ): Promise<boolean> => {
    const result = await lock(key, async () => {
      try {
        const response = await commandRequest<T>(url, method, { ...body, expectedUpdatedAt: revisionRef.current });
        updateRevision(response.meta.updatedAt);
        apply(response.data);
        announceSuccess(success);
        return true;
      } catch (error) {
        announceFailure(error, "Không thể cập nhật chương.");
        return false;
      }
    });
    return result ?? false;
  };

  const chapterBase = `/api/stories/${encodeURIComponent(story.id)}/chapters`;
  const createChapter = async (title: string, afterChapterId?: string): Promise<ManagedChapter | null> => {
    const result = await lock("create-chapter", async () => {
      try {
        const response = await commandRequest<ManagedChapter>(chapterBase, "POST", {
          title,
          ...(afterChapterId === undefined ? {} : { afterChapterId }),
          expectedUpdatedAt: revisionRef.current,
        });
        updateRevision(response.meta.updatedAt);
        setStory((current) => {
          const ordered = [...current.chapters].sort((left, right) => left.order - right.order);
          const anchorIndex = afterChapterId === undefined
            ? ordered.length - 1
            : ordered.findIndex((chapter) => chapter.id === afterChapterId);
          const insertionIndex = anchorIndex < 0 ? ordered.length : anchorIndex + 1;
          const next = [...ordered];
          next.splice(insertionIndex, 0, response.data);
          return {
            ...current,
            chapters: next.map((chapter, index) => ({ ...chapter, order: index + 1 })),
          };
        });
        announceSuccess("Đã thêm chương mới.");
        return response.data;
      } catch (error) {
        announceFailure(error, "Không thể thêm chương.");
        return null;
      }
    });
    return result ?? null;
  };

  const chapterActions: ChapterManagerActions = {
    onCreate: createChapter,
    onRename: (chapterId, title) => runChapter<ManagedChapter>(
      `rename-${chapterId}`, `${chapterBase}/${encodeURIComponent(chapterId)}`, "PATCH", { title },
      replaceChapter, "Đã đổi tên chương.",
    ),
    onDelete: (chapter) => runChapter<null>(
      `delete-${chapter.id}`, `${chapterBase}/${encodeURIComponent(chapter.id)}`, "DELETE", {},
      () => setStory((current) => ({ ...current, chapters: current.chapters.filter((candidate) => candidate.id !== chapter.id) })),
      "Đã xóa chương.",
    ),
    onReorder: (chapterIds) => runChapter<ChapterOrder[]>(
      "reorder-chapters", `${chapterBase}/reorder`, "PATCH", { chapterIds },
      (orders) => setStory((current) => {
        const orderById = new Map(orders.map((chapter) => [chapter.id, chapter.order]));
        return {
          ...current,
          chapters: current.chapters
            .map((chapter) => ({ ...chapter, order: orderById.get(chapter.id) ?? chapter.order }))
            .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)),
        };
      }),
      "Đã sắp xếp lại chương.",
    ),
    onTogglePublication: (chapter) => runChapter<ManagedChapter>(
      `publish-${chapter.id}`, `${chapterBase}/${encodeURIComponent(chapter.id)}/publish`, "PATCH",
      { status: chapter.status === "published" ? "draft" : "published" },
      replaceChapter,
      chapter.status === "published" ? "Đã gỡ chương khỏi mục lục công khai." : "Đã đánh dấu chương là published.",
    ),
  };

  const runStoryAction = async (action: "submit" | "cancel-review" | "archive" | "restore" | "delete") => {
    if (operationRef.current) return;
    if (action === "archive") {
      const accepted = await confirm({
        title: `Gỡ “${story.title}”?`,
        description: "Truyện sẽ biến mất khỏi khu vực đọc công khai và chuyển vào Lưu trữ.",
        confirmText: "Gỡ truyện",
        variant: "warning",
      });
      if (!accepted) return;
    }
    if (action === "delete") {
      const accepted = await confirm({
        title: story.status === "archived" ? `Xóa vĩnh viễn “${story.title}”?` : `Xóa “${story.title}”?`,
        description: "Toàn bộ chương, nội dung, hiệu ứng và bối cảnh sẽ bị xóa. Hành động này không thể hoàn tác.",
        confirmText: story.status === "archived" ? "Xóa vĩnh viễn" : "Xóa truyện",
        variant: "danger",
      });
      if (!accepted) return;
    }

    await lock(`story-${action}`, async () => {
      try {
        const base = `/api/stories/${encodeURIComponent(story.id)}`;
        if (action === "delete") {
          await commandRequest<null>(base, "DELETE", { expectedUpdatedAt: revisionRef.current });
          toast.success("Đã xóa truyện.");
          router.push("/author");
          router.refresh();
          return;
        }
        const endpoint = action === "submit" ? "submit-review" : action;
        const result = await commandRequest<ManagedStory>(`${base}/${endpoint}`, "POST", { expectedUpdatedAt: revisionRef.current });
        updateRevision(result.meta.updatedAt);
        setStory(result.data);
        if (result.data.status !== "rejected") setRejectionReason(null);
        announceSuccess(action === "submit"
          ? "Đã gửi truyện để duyệt."
          : action === "cancel-review"
            ? "Đã rút truyện về bản nháp."
            : action === "archive"
              ? "Đã gỡ và lưu trữ truyện."
              : "Đã khôi phục truyện về bản nháp.");
      } catch (error) {
        announceFailure(error, "Không thể cập nhật trạng thái truyện.");
      }
    });
  };

  const summaryErrors = Object.entries(formErrors).map(([field, message]) => ({
    href: `#story-${field}`,
    message,
  }));

  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/author" className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Về Truyện của tôi
      </Link>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:p-6" aria-labelledby="manage-story-title">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3"><StatusBadge status={story.status} /></div>
            <h1 id="manage-story-title" className="font-display text-3xl font-bold leading-tight sm:text-4xl">{story.title}</h1>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Bút danh: {story.author}</p>
            <p className="mt-3 max-w-2xl text-[var(--color-muted-foreground)]">{statusDescription(story)}</p>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {(story.status === "draft" || story.status === "rejected") ? (
              <PublishStoryButton story={story} busy={Boolean(busyOperation)} disabledReason={metadataDirty ? "Lưu thay đổi thông tin truyện trước khi gửi duyệt." : undefined} onSubmit={() => void runStoryAction("submit")} />
            ) : null}
            {story.status === "pending_review" ? (
              <button type="button" disabled={Boolean(busyOperation)} onClick={() => void runStoryAction("cancel-review")} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-muted)] disabled:opacity-50">
                <Undo2 aria-hidden="true" className="h-4 w-4" /> Hủy gửi duyệt
              </button>
            ) : null}
            {story.status === "published" ? (
              <button type="button" disabled={Boolean(busyOperation) || metadataDirty} title={metadataDirty ? "Lưu thay đổi thông tin trước khi gỡ truyện" : undefined} onClick={() => void runStoryAction("archive")} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--color-warning)]/40 px-4 text-sm font-semibold text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10 disabled:cursor-not-allowed disabled:opacity-50">
                <Archive aria-hidden="true" className="h-4 w-4" /> Gỡ truyện
              </button>
            ) : null}
            {story.status === "archived" ? (
              <button type="button" disabled={Boolean(busyOperation)} onClick={() => void runStoryAction("restore")} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
                <RotateCcw aria-hidden="true" className="h-4 w-4" /> Khôi phục để chỉnh sửa
              </button>
            ) : null}
          </div>
        </div>

        {story.status === "rejected" ? (
          <div className="mt-5 rounded-xl border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 p-4" role="status">
            <h2 className="flex items-center gap-2 font-semibold text-[var(--color-destructive)]"><ShieldAlert aria-hidden="true" className="h-5 w-5" /> Phản hồi từ quản trị viên</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{rejectionReason || "Chưa có lý do từ chối được cung cấp."}</p>
          </div>
        ) : null}
        {story.status === "pending_review" ? (
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-[var(--color-warning)]/10 p-3 text-sm text-[var(--color-warning)]"><Clock3 aria-hidden="true" className="h-4 w-4" /> Bạn có thể hủy gửi để mở lại quyền chỉnh sửa.</p>
        ) : null}
      </section>

      {pageError ? <div className="mt-5 rounded-xl border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 p-3 text-sm text-[var(--color-destructive)]">{pageError}</div> : null}

      <section className="mt-8 scroll-mt-24" aria-labelledby="story-information-title">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">Thông tin cơ bản</p>
          <h2 id="story-information-title" className="mt-1 font-display text-2xl font-bold">Thông tin truyện</h2>
        </div>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
          <form onSubmit={saveMetadata} noValidate className="glass-card border border-[var(--color-border)] bg-[var(--color-card)]/85 p-5 sm:p-7">
            <FormErrorSummary errors={summaryErrors} summaryRef={summaryRef} />
            <div className={summaryErrors.length > 0 ? "mt-6" : ""}>
              <StoryForm
                value={form}
                onChange={handleFormChange}
                errors={formErrors}
                currentCoverUrl={story.cover_image}
                currentCoverPosition={story.cover_position}
                disabled={readOnly || Boolean(busyOperation)}
                upload={upload.state}
                onCancelUpload={upload.cancel}
                onRetryUpload={() => void saveMetadata()}
                showUploadStatus={false}
              />
            </div>
            <div className="mt-5">
              <CoverUploadProgress upload={upload.state} onCancel={upload.cancel} onRetry={() => void saveMetadata()} />
            </div>
            {!readOnly ? (
              <div className="mt-7 flex justify-end">
                <button type="submit" disabled={Boolean(busyOperation) || !metadataDirty} className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:pointer-events-none disabled:opacity-50 sm:w-auto">
                  {busyOperation === "metadata" ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" className="h-4 w-4" />}
                  {busyOperation === "metadata" ? "Đang lưu…" : "Lưu thông tin"}
                </button>
              </div>
            ) : null}
          </form>
          <LiveStoryCardPreview
            value={form}
            currentCoverUrl={story.cover_image}
            headingLevel="h3"
            className="self-start xl:sticky xl:top-24"
          />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="story-chapters-title">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">Cấu trúc tác phẩm</p>
          <h2 id="story-chapters-title" className="mt-1 font-display text-2xl font-bold">Danh sách chương</h2>
        </div>
        <ChapterListManager mode="manage" storyId={story.id} storyStatus={story.status} chapters={story.chapters} busy={Boolean(busyOperation)} actions={chapterActions} />
      </section>

      {(story.status === "draft" || story.status === "archived") ? (
        <section className="mt-10 rounded-2xl border border-[var(--color-destructive)]/25 p-5" aria-labelledby="danger-zone-title">
          <h2 id="danger-zone-title" className="font-semibold text-[var(--color-destructive)]">Vùng nguy hiểm</h2>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Xóa toàn bộ truyện và các chương. Hành động này không thể hoàn tác.</p>
          <button type="button" disabled={Boolean(busyOperation)} onClick={() => void runStoryAction("delete")} className="mt-4 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--color-destructive)]/40 px-4 text-sm font-semibold text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 disabled:opacity-50">
            <Trash2 aria-hidden="true" className="h-4 w-4" /> {story.status === "archived" ? "Xóa vĩnh viễn" : "Xóa truyện"}
          </button>
        </section>
      ) : null}
    </main>
  );
}
