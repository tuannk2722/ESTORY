"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { Story } from "@/types/story";
import { DEFAULT_COVER_POSITION } from "@/lib/story-cover";
import { AuthorRequestError, commandRequest, friendlyRequestMessage, UploadCancelledError } from "./authorTransport";
import ChapterListManager from "./ChapterListManager";
import { CoverUploadProgress } from "./CoverUploader";
import FormErrorSummary, { type SummaryError } from "./FormErrorSummary";
import LiveStoryCardPreview from "./LiveStoryCardPreview";
import StoryForm from "./StoryForm";
import { validateStoryForm, validateWizardChapters } from "./storyRules";
import type { ChapterFieldErrors, StoryFieldErrors, StoryFormValue, WizardChapter } from "./types";
import { useCoverUpload } from "./useCoverUpload";

interface StoryWizardProps {
  initialByline: string;
}

function storySummary(errors: StoryFieldErrors): SummaryError[] {
  const targets: Record<keyof StoryFieldErrors, string> = {
    title: "#story-title",
    byline: "#story-byline",
    description: "#story-description",
    genre: "#story-genre",
    cover: "#story-cover",
  };
  return Object.entries(errors).map(([field, message]) => ({ href: targets[field as keyof StoryFieldErrors], message }));
}

function chapterSummary(errors: ChapterFieldErrors): SummaryError[] {
  return Object.entries(errors).map(([field, message]) => ({
    href: field === "chapters" ? "#chapter-list" : `#wizard-${field}-title`,
    message,
  }));
}

function serverFieldErrors(
  error: AuthorRequestError,
  chapters: WizardChapter[],
): { story: StoryFieldErrors; chapters: ChapterFieldErrors } {
  const story: StoryFieldErrors = {};
  const chapterErrors: ChapterFieldErrors = {};
  for (const [path, messages] of Object.entries(error.fieldErrors ?? {})) {
    const message = messages[0];
    if (!message) continue;
    if (path === "byline") story.byline = message;
    else if (path === "coverUploadId") story.cover = message;
    else if (path === "metadata.title") story.title = message;
    else if (path === "metadata.description") story.description = message;
    else if (path === "metadata.genre") story.genre = message;
    else {
      const match = /^chapters\.(\d+)\.title$/.exec(path);
      const chapter = match ? chapters[Number(match[1])] : undefined;
      if (chapter) chapterErrors[chapter.clientId] = message;
    }
  }
  return { story, chapters: chapterErrors };
}

export default function StoryWizard({ initialByline }: StoryWizardProps) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const summaryRef = useRef<HTMLDivElement>(null);
  const focusSummaryPendingRef = useRef(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<StoryFormValue>({
    title: "",
    byline: initialByline,
    description: "",
    genre: [],
    coverFile: null,
    coverPreviewUrl: null,
    coverPosition: { ...DEFAULT_COVER_POSITION },
    coverError: null,
  });
  const [chapters, setChapters] = useState<WizardChapter[]>([{ clientId: "chapter-1", title: "" }]);
  const [storyErrors, setStoryErrors] = useState<StoryFieldErrors>({});
  const [chapterErrors, setChapterErrors] = useState<ChapterFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const upload = useCoverUpload();
  const formRef = useRef(form);

  const summaryErrors = useMemo(() => [
    ...storySummary(storyErrors),
    ...(step === 2 ? chapterSummary(chapterErrors) : []),
    ...(submitError ? [{ href: "#wizard-submit-error", message: submitError }] : []),
  ], [chapterErrors, step, storyErrors, submitError]);
  const stepOneReady = useMemo(
    () => Object.keys(validateStoryForm(form, { requireByline: true, hasExistingCover: false })).length === 0,
    [form],
  );

  useEffect(() => {
    if (!focusSummaryPendingRef.current || summaryErrors.length === 0) return;
    focusSummaryPendingRef.current = false;
    summaryRef.current?.focus();
  }, [summaryErrors]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => () => {
    const previewUrl = formRef.current.coverPreviewUrl;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, []);

  const focusSummary = () => { focusSummaryPendingRef.current = true; };

  const handleFormChange = (next: StoryFormValue) => {
    if (next.coverFile !== form.coverFile) upload.resetForFile(next.coverFile);
    setForm(next);
    if (Object.keys(storyErrors).length > 0) {
      setStoryErrors(validateStoryForm(next, { requireByline: true, hasExistingCover: false }));
    }
    setSubmitError(null);
  };

  const continueToChapters = (event: FormEvent) => {
    event.preventDefault();
    const errors = validateStoryForm(form, { requireByline: true, hasExistingCover: false });
    setStoryErrors(errors);
    if (Object.keys(errors).length > 0) return focusSummary();
    setSubmitError(null);
    setStep(2);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const saveStory = async (event?: FormEvent) => {
    event?.preventDefault();
    if (saving) return;
    const nextStoryErrors = validateStoryForm(form, { requireByline: true, hasExistingCover: false });
    const nextChapterErrors = validateWizardChapters(chapters);
    setStoryErrors(nextStoryErrors);
    setChapterErrors(nextChapterErrors);
    if (Object.keys(nextStoryErrors).length > 0) {
      setStep(1);
      focusSummary();
      return;
    }
    if (Object.keys(nextChapterErrors).length > 0) {
      setStep(2);
      focusSummary();
      return;
    }
    if (!form.coverFile) return;

    setSaving(true);
    setSubmitError(null);
    try {
      const coverUploadId = await upload.ensureUploaded(form.coverFile);
      const result = await commandRequest<Story>("/api/stories", "POST", {
        byline: form.byline,
        coverUploadId,
        metadata: {
          title: form.title,
          description: form.description,
          genre: form.genre,
          cover_position: form.coverPosition,
        },
        chapters: chapters.map((chapter) => ({ title: chapter.title })),
      });
      toast.success("Đã tạo truyện. Bây giờ bạn có thể viết chương đầu tiên.");
      await updateSession().catch(() => null);
      router.push(`/author/stories/${encodeURIComponent(result.data.id)}`);
      router.refresh();
    } catch (error) {
      if (error instanceof UploadCancelledError) {
        setSubmitError("Đã hủy tải ảnh. Dữ liệu bạn nhập vẫn được giữ nguyên.");
        focusSummary();
        return;
      }
      if (error instanceof AuthorRequestError && error.fieldErrors) {
        const fields = serverFieldErrors(error, chapters);
        if (Object.keys(fields.story).length > 0) {
          setStoryErrors((current) => ({ ...current, ...fields.story }));
          setStep(1);
        }
        if (Object.keys(fields.chapters).length > 0) {
          setChapterErrors((current) => ({ ...current, ...fields.chapters }));
          if (Object.keys(fields.story).length === 0) setStep(2);
        }
        focusSummary();
      }
      const message = friendlyRequestMessage(error, "Không thể tạo truyện. Hãy thử lại.");
      setSubmitError(message);
      toast.error(message);
      focusSummary();
    } finally {
      setSaving(false);
    }
  };

  const handleChaptersChange = (next: WizardChapter[]) => {
    setChapters(next);
    if (Object.keys(chapterErrors).length > 0) setChapterErrors(validateWizardChapters(next));
    setSubmitError(null);
  };

  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/" className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Quay lại trang chủ
      </Link>
      <div className="flex flex-col gap-4 items-center justify-center mb-8">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Bắt đầu câu chuyện của bạn</h1>
        <p className="mt-2 text-[var(--color-muted-foreground)]">Hai bước ngắn để tạo khung truyện. Nội dung chi tiết sẽ được viết trong trình soạn thảo.</p>
      </div>

      <ol className="flex items-center justify-center mb-8 gap-4" aria-label="Tiến trình tạo truyện">
        {[
          { number: 1 as const, label: "Thông tin truyện" },
          { number: 2 as const, label: "Danh sách chương" },
        ].map((item) => {
          const current = step === item.number;
          const complete = step > item.number;
          return (
            <li key={item.number} aria-current={current ? "step" : undefined} className={`flex min-h-14 items-center gap-3 rounded-2xl  px-3 sm:px-4`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${current || complete ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]" : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"}`}>
                {complete ? <Check aria-label="Hoàn tất" className="h-4 w-4" /> : item.number}
              </span>
              <span className="hidden sm:inline text-sm font-semibold leading-tight">{item.label}</span>
            </li>
          );
        })}
      </ol>

      <div className={step === 1 ? "xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8" : "mx-auto max-w-3xl"}>
        <div>
          <FormErrorSummary errors={summaryErrors} summaryRef={summaryRef} />
          {submitError ? <div id="wizard-submit-error" role="alert" tabIndex={-1} className="mt-4 rounded-xl border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 p-3 text-sm text-[var(--color-destructive)]">{submitError}</div> : null}
        </div>
      </div>

      {step === 1 ? (
        <div className="mt-5 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
          <section className="glass-card border border-[var(--color-border)] bg-[var(--color-card)]/85 p-5 sm:p-7">
            <form onSubmit={continueToChapters} noValidate>
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Bước 1/2</p>
                <h2 className="mt-1 font-display text-2xl font-bold">Thông tin truyện</h2>
              </div>
              <StoryForm
                value={form}
                onChange={handleFormChange}
                errors={storyErrors}
                showByline
                disabled={saving}
                upload={upload.state}
                onCancelUpload={upload.cancel}
                onRetryUpload={() => void saveStory()}
              />
              <div className="mt-8 flex justify-end">
                {!stepOneReady ? <p id="step-one-requirements" className="mr-3 self-center text-right text-xs text-[var(--color-muted-foreground)]">Hoàn thiện các trường bắt buộc để tiếp tục.</p> : null}
                <button type="submit" disabled={saving || !stepOneReady} aria-describedby={!stepOneReady ? "step-one-requirements" : undefined} className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
                  Tiếp tục <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </form>
          </section>
          <LiveStoryCardPreview value={form} className="self-start xl:sticky xl:top-24" />
        </div>
      ) : (
        <section className="glass-card mx-auto mt-5 w-full max-w-3xl border border-[var(--color-border)] bg-[var(--color-card)]/85 p-5 sm:p-7">
          <form onSubmit={saveStory} noValidate>
            <div id="chapter-list" className="mb-6 scroll-mt-24">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Bước 2/2</p>
              <h2 className="mt-1 font-display text-2xl font-bold">Danh sách chương</h2>
            </div>
            <ChapterListManager mode="wizard" chapters={chapters} errors={chapterErrors} disabled={saving} onChange={handleChaptersChange} />
            <div className="mt-5">
              <CoverUploadProgress upload={upload.state} onCancel={upload.cancel} onRetry={() => void saveStory()} />
            </div>
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button type="button" disabled={saving} onClick={() => setStep(1)} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-muted)] disabled:pointer-events-none disabled:opacity-50">
                <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Quay lại
              </button>
              <button type="submit" disabled={saving} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:pointer-events-none disabled:opacity-50">
                {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" className="h-4 w-4" />}
                {saving ? "Đang lưu truyện…" : "Lưu truyện"}
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
