import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import ReaderPane from "@/components/reader/ReaderPane";
import { requirePageRole } from "@/lib/auth/page-guards";
import { CommandError } from "@/lib/services/command-error";
import { StoryDataAccess } from "@/lib/services/story-dal";
import { getChapterAudioAttributions } from "@/lib/repositories/audio-attribution-repository";

export default async function AdminStoryPreviewPage({
  params,
}: {
  params: Promise<{ storyId: string; chapterId: string }>;
}) {
  const { storyId, chapterId } = await params;
  const session = await requirePageRole(
    "admin",
    `/admin/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}/preview`,
  );
  let preview: Awaited<ReturnType<StoryDataAccess["getModerationPreview"]>>;
  try {
    preview = await new StoryDataAccess().getModerationPreview(
      session.user.id,
      storyId,
      chapterId,
    );
  } catch (error) {
    if (error instanceof CommandError && error.status === 404) notFound();
    throw error;
  }

  const audioAttributions = await getChapterAudioAttributions(preview.data.chapter, preview.data.scenes);
  return (
    <div className="reader-screen min-h-dvh bg-[#05070F] text-[#F8FAFC]">
      <header
        data-reader-header
        className="font-ui sticky top-0 z-40 w-full border-b border-[var(--color-border)] bg-[var(--color-card)]/90 text-[var(--color-foreground)] shadow-sm backdrop-blur-md transition-colors duration-200 motion-reduce:transition-none"
      >
        <div className="mx-auto grid min-h-16 w-full max-w-5xl grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-2 px-2 sm:gap-4 sm:px-4">
          <Link
            href="/admin/stories"
            aria-label="Về danh sách kiểm duyệt truyện"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 justify-self-start rounded-xl px-2 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none sm:justify-start sm:px-3"
          >
            <ArrowLeft
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
            />
            <span className="hidden truncate sm:inline">Về kiểm duyệt</span>
          </Link>
          <div
            className="min-w-0 text-center leading-tight"
            title={`${preview.data.story.title} · ${preview.data.chapter.title}`}
          >
            <p className="truncate text-xs font-medium text-[var(--color-muted-foreground)]">
              {preview.data.story.title}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[var(--color-foreground)] sm:text-base">
              {preview.data.chapter.title}
            </p>
          </div>
          <span
            aria-label="Bản xem trước dành cho quản trị viên"
            className="inline-flex min-h-9 items-center justify-center gap-2 justify-self-end rounded-xl border border-[var(--color-success)]/35 bg-[var(--color-success)]/10 px-2 text-xs font-semibold text-[var(--color-success)] sm:px-3"
          >
            <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span aria-hidden="true" className="hidden sm:inline md:hidden">
              Admin
            </span>
            <span aria-hidden="true" className="hidden whitespace-nowrap md:inline">
              Bản xem trước Admin
            </span>
          </span>
        </div>
      </header>
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
        <ReaderPane
          storyId={preview.data.story.id}
          chapter={preview.data.chapter}
          scenes={preview.data.scenes}
          isPreview
          audioAttributions={audioAttributions}
        />
      </div>
    </div>
  );
}
