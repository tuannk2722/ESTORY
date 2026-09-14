"use client";

import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import StoryCoverImage from "@/components/story/StoryCoverImage";
import { useConfirm } from "@/components/ui/ConfirmModal";
import StoryStatusBadge from "@/components/ui/StoryStatusBadge";
import { coverObjectPosition } from "@/lib/story-cover";
import type {
  ModerationChapterSummary,
  ModerationStoryDetail,
  ModerationStoryListItem,
} from "@/types/story-moderation";
import {
  AdminRequestError,
  getModerationDetail,
  moderationErrorMessage,
  submitModerationDecision,
} from "./adminTransport";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

function formatDate(value: string | null): string {
  if (!value) return "Chưa gửi";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? dateFormatter.format(parsed) : "Không xác định";
}

function Cover({ story }: { story: Pick<ModerationStoryDetail, "title" | "cover_image" | "cover_position"> }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-secondary)] via-[var(--color-card)] to-[var(--color-primary)]/30">
      {story.cover_image ? (
        <StoryCoverImage
          src={story.cover_image}
          alt={`Ảnh bìa ${story.title}`}
          objectPosition={coverObjectPosition(story.cover_position)}
          sizes="(max-width: 768px) 100vw, 42rem"
        />
      ) : (
        <BookOpen aria-hidden="true" className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
      )}
    </div>
  );
}

function ChapterSummary({ storyId, chapter }: { storyId: string; chapter: ModerationChapterSummary }) {
  return (
    <li className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Chương {chapter.order}</p>
          <h3 className="mt-1 font-semibold text-[var(--color-foreground)]">{chapter.title}</h3>
        </div>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted-foreground)]">
          {chapter.status === "published" ? "Đã xuất bản" : "Bản nháp"}
        </span>
      </div>
      <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
        {chapter.blockCount} block · {chapter.effectCount} hiệu ứng
      </p>
      <Link
        href={`/admin/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapter.id)}/preview`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-muted)]"
      >
        <ExternalLink aria-hidden="true" className="h-4 w-4" />
        Đọc thử chương
      </Link>
    </li>
  );
}

function RejectReasonModal({
  storyTitle,
  value,
  pending,
  error,
  onChange,
  onCancel,
  onSubmit,
}: {
  storyTitle: string;
  value: string;
  pending: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onCancel, pending]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return createPortal(
    <div
      data-admin-reject-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (!pending && event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl outline-none"
      >
        <form onSubmit={handleSubmit}>
          <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] p-5">
            <div>
              <h2 id={titleId} className="font-display text-xl font-bold">Từ chối tác phẩm?</h2>
              <p id={descriptionId} className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                Nêu rõ vấn đề để tác giả có thể sửa “{storyTitle}”.
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              aria-label="Đóng hộp thoại từ chối"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </header>
          <div className="space-y-4 p-5">
            {error ? (
              <div id={errorId} role="alert" className="flex gap-2 rounded-xl border border-[var(--color-destructive)]/35 bg-[var(--color-destructive)]/10 p-3 text-sm text-[var(--color-destructive)]">
                <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
            <div>
              <div className="flex items-end justify-between gap-3">
                <label htmlFor="admin-rejection-reason" className="text-sm font-semibold">Lý do từ chối</label>
                <span className={`text-xs ${value.length > 2_000 ? "text-[var(--color-destructive)]" : "text-[var(--color-muted-foreground)]"}`}>
                  {value.length}/2000
                </span>
              </div>
              <textarea
                id="admin-rejection-reason"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={pending}
                maxLength={2_050}
                rows={7}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : descriptionId}
                placeholder="Ví dụ: Chương 2 còn thiếu nội dung; vui lòng bổ sung trước khi gửi duyệt lại."
                className="mt-2 min-h-40 w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-3 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]"
              />
              <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">Từ 5 đến 2000 ký tự sau khi bỏ khoảng trắng thừa ở hai đầu.</p>
            </div>
          </div>
          <footer className="flex flex-col-reverse gap-2 border-t border-[var(--color-border)] bg-[var(--color-muted)]/35 p-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-destructive)] px-4 text-sm font-semibold text-[var(--color-destructive-foreground)] hover:brightness-95 disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
              {pending ? "Đang từ chối…" : "Xác nhận từ chối"}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default function StoryReviewDrawer({
  story,
  onClose,
  onCompleted,
}: {
  story: ModerationStoryListItem;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const confirm = useConfirm();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const interactionLockedRef = useRef(false);
  const titleId = useId();
  const [detail, setDetail] = useState<ModerationStoryDetail | null>(null);
  const [revision, setRevision] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [confirmActive, setConfirmActive] = useState(false);

  useEffect(() => {
    interactionLockedRef.current = rejectOpen || confirmActive || actionPending;
  }, [actionPending, confirmActive, rejectOpen]);

  useEffect(() => {
    const controller = new AbortController();
    void getModerationDetail(story.id, controller.signal)
      .then((result) => {
        setDetail(result.data);
        setRevision(result.meta.updatedAt);
        setLoadError(null);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(moderationErrorMessage(error));
        setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey, story.id]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => panelRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (interactionLockedRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    setStale(false);
    setDetail(null);
    setRevision(null);
    setReloadKey((value) => value + 1);
  }, []);

  const decide = async (decision: "approve" | "reject", reason?: string) => {
    if (!revision || actionPending || stale) return;
    setActionPending(true);
    setActionError(null);
    if (decision === "reject") setRejectError(null);
    try {
      await submitModerationDecision(story.id, decision, {
        expectedUpdatedAt: revision,
        ...(reason === undefined ? {} : { reason }),
      });
      toast.success(decision === "approve" ? "Đã phê duyệt tác phẩm." : "Đã từ chối tác phẩm.");
      onCompleted();
    } catch (error) {
      const message = moderationErrorMessage(error);
      if (error instanceof AdminRequestError && error.status === 409) {
        setStale(true);
        setRejectOpen(false);
        setActionError("Dữ liệu tác phẩm đã thay đổi. Hãy tải dữ liệu mới trước khi quyết định lại.");
      } else if (decision === "reject") {
        setRejectError(message);
      } else {
        setActionError(message);
      }
    } finally {
      setActionPending(false);
    }
  };

  const handleApprove = async () => {
    if (!detail || !revision || stale) return;
    setConfirmActive(true);
    const accepted = await confirm({
      title: `Phê duyệt tác phẩm “${detail.title}”?`,
      description: "Tác phẩm sẽ xuất hiện công khai và toàn bộ chương sẽ được chuyển sang trạng thái đã xuất bản.",
      variant: "success",
      confirmText: "Phê duyệt ngay",
      cancelText: "Hủy bỏ",
      icon: ShieldCheck,
    });
    setConfirmActive(false);
    if (accepted) await decide("approve");
  };

  const handleReject = () => {
    const reason = rejectReason.trim();
    if (reason.length < 5 || reason.length > 2_000) {
      setRejectError("Lý do từ chối phải có từ 5 đến 2000 ký tự sau khi bỏ khoảng trắng thừa.");
      return;
    }
    void decide("reject", reason);
  };

  const decisionAvailable = detail?.status === "pending_review";
  const panel = (
    <div
      className="fixed inset-0 z-[80] bg-black/65 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !interactionLockedRef.current) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        inert={rejectOpen || confirmActive ? true : undefined}
        aria-hidden={rejectOpen || confirmActive ? true : undefined}
        className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl outline-none"
      >
        <header className="sticky top-0 z-10 flex min-h-20 items-start justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-card)]/95 p-4 backdrop-blur-md sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Chi tiết kiểm duyệt</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 id={titleId} className="min-w-0 font-display text-xl font-bold sm:text-2xl">{detail?.title ?? story.title}</h2>
              <StoryStatusBadge status={detail?.status ?? story.status} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={actionPending}
            aria-label="Đóng chi tiết kiểm duyệt"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-8 sm:p-6 sm:pb-8">
          {loading ? (
            <div aria-live="polite" className="space-y-4" aria-label="Đang tải chi tiết tác phẩm">
              <div className="aspect-video animate-pulse rounded-2xl bg-[var(--color-muted)] motion-reduce:animate-none" />
              <div className="h-7 w-2/3 animate-pulse rounded bg-[var(--color-muted)] motion-reduce:animate-none" />
              <div className="h-24 animate-pulse rounded-2xl bg-[var(--color-muted)] motion-reduce:animate-none" />
            </div>
          ) : loadError || !detail ? (
            <div role="alert" className="rounded-2xl border border-[var(--color-destructive)]/35 bg-[var(--color-destructive)]/10 p-5">
              <div className="flex gap-3">
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-destructive)]" />
                <div>
                  <h3 className="font-semibold">Không tải được chi tiết</h3>
                  <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{loadError ?? "Phản hồi không hợp lệ."}</p>
                  <button
                    type="button"
                    onClick={reload}
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-muted)]"
                  >
                    <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    Thử lại
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <Cover story={detail} />

              {(actionError || stale) ? (
                <div role="alert" className="rounded-2xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-4">
                  <div className="flex gap-3">
                    <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-warning)]" />
                    <div>
                      <p className="text-sm font-semibold">{actionError}</p>
                      {stale ? (
                        <button
                          type="button"
                          onClick={reload}
                          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 text-sm font-semibold hover:bg-[var(--color-muted)]"
                        >
                          <RefreshCw aria-hidden="true" className="h-4 w-4" />
                          Tải dữ liệu mới
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <section aria-labelledby="review-author-heading" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                <h3 id="review-author-heading" className="font-semibold">Tác giả và thời gian</h3>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex min-w-0 gap-2">
                    <UserRound aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
                    <div className="min-w-0"><dt className="text-xs text-[var(--color-muted-foreground)]">Bút danh</dt><dd className="truncate font-medium">{detail.author}</dd></div>
                  </div>
                  <div className="flex min-w-0 gap-2">
                    <Mail aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
                    <div className="min-w-0"><dt className="text-xs text-[var(--color-muted-foreground)]">Email tài khoản</dt><dd className="break-all font-medium">{detail.authorEmail}</dd></div>
                  </div>
                  <div className="flex gap-2">
                    <CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
                    <div><dt className="text-xs text-[var(--color-muted-foreground)]">Ngày tạo</dt><dd className="font-medium">{formatDate(detail.createdAt)}</dd></div>
                  </div>
                  <div className="flex gap-2">
                    <CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
                    <div><dt className="text-xs text-[var(--color-muted-foreground)]">Gửi duyệt gần nhất</dt><dd className="font-medium">{formatDate(detail.submittedAt)}</dd></div>
                  </div>
                </dl>
              </section>

              <section aria-labelledby="review-description-heading">
                <h3 id="review-description-heading" className="font-semibold">Giới thiệu tác phẩm</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-muted-foreground)]">{detail.description}</p>
                {detail.genre.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detail.genre.map((genre) => (
                      <span key={genre} className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1 text-xs font-medium">{genre}</span>
                    ))}
                  </div>
                ) : null}
                {detail.rejectionReason ? (
                  <div className="mt-4 rounded-xl border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 p-3 text-sm">
                    <p className="font-semibold text-[var(--color-destructive)]">Lý do từ chối gần nhất</p>
                    <p className="mt-1 whitespace-pre-wrap text-[var(--color-muted-foreground)]">{detail.rejectionReason}</p>
                  </div>
                ) : null}
              </section>

              <section aria-labelledby="review-chapters-heading">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 id="review-chapters-heading" className="font-semibold">Danh sách chương</h3>
                    {/* <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">Hiệu ứng được đếm theo block; bối cảnh được kiểm tra trong bản đọc thử.</p> */}
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{detail.chapters.length} chương</span>
                </div>
                <ol className="mt-3 space-y-3">
                  {detail.chapters.map((chapter) => (
                    <ChapterSummary key={chapter.id} storyId={detail.id} chapter={chapter} />
                  ))}
                </ol>
              </section>
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 z-10 border-t border-[var(--color-border)] bg-[var(--color-card)]/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
          {decisionAvailable ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setRejectReason("");
                  setRejectError(null);
                  setRejectOpen(true);
                }}
                disabled={actionPending || loading || stale}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-destructive)]/45 px-4 text-sm font-semibold text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Từ chối
              </button>
              <button
                type="button"
                onClick={() => void handleApprove()}
                disabled={actionPending || loading || stale}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-success)] px-4 text-sm font-semibold text-[var(--color-success-foreground)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionPending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <ShieldCheck aria-hidden="true" className="h-4 w-4" />}
                {actionPending ? "Đang xử lý…" : "Phê duyệt tác phẩm"}
              </button>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-muted)]"
              >
                Đóng
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(panel, document.body)}
      {rejectOpen && detail ? (
        <RejectReasonModal
          storyTitle={detail.title}
          value={rejectReason}
          pending={actionPending}
          error={rejectError}
          onChange={(value) => {
            setRejectReason(value);
            if (rejectError) setRejectError(null);
          }}
          onCancel={() => {
            if (!actionPending) setRejectOpen(false);
          }}
          onSubmit={handleReject}
        />
      ) : null}
    </>
  );
}
