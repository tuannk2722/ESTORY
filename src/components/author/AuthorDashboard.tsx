"use client";

import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/ConfirmModal";
import type { StoryStatus } from "@/types/story";
import type { AuthorStoryListItem, ManagedStory } from "@/types/story-management";
import { commandRequest, friendlyRequestMessage } from "./authorTransport";
import StoryManageCard from "./StoryManageCard";
import type { StoryAction } from "./types";

interface AuthorDashboardProps {
  initialStories: AuthorStoryListItem[];
}

type Filter = "all" | StoryStatus;

const TABS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "draft", label: "Nháp" },
  { value: "pending_review", label: "Chờ duyệt" },
  { value: "published", label: "Đã xuất bản" },
  { value: "rejected", label: "Bị từ chối" },
  { value: "archived", label: "Lưu trữ" },
];

const ACTION_ENDPOINTS: Record<StoryAction, string> = {
  submit: "submit-review",
  "cancel-review": "cancel-review",
  archive: "archive",
  restore: "restore",
  delete: "",
};

const ACTION_SUCCESS: Record<StoryAction, string> = {
  submit: "Đã gửi truyện để duyệt.",
  "cancel-review": "Đã rút truyện về bản nháp.",
  archive: "Đã gỡ và lưu trữ truyện.",
  restore: "Đã khôi phục truyện về bản nháp.",
  delete: "Đã xóa truyện.",
};

export default function AuthorDashboard({ initialStories }: AuthorDashboardProps) {
  const [stories, setStories] = useState(initialStories);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyStoryId, setBusyStoryId] = useState<string | null>(null);
  const confirm = useConfirm();
  const visibleStories = filter === "all" ? stories : stories.filter((item) => item.story.status === filter);

  const runAction = async (action: StoryAction, item: AuthorStoryListItem) => {
    if (busyStoryId) return;
    if (action === "archive") {
      const accepted = await confirm({
        title: `Gỡ “${item.story.title}”?`,
        description: "Truyện sẽ biến mất khỏi khu vực đọc công khai và chuyển vào Lưu trữ.",
        confirmText: "Gỡ truyện",
        variant: "warning",
      });
      if (!accepted) return;
    }
    if (action === "delete") {
      const permanent = item.story.status === "archived";
      const accepted = await confirm({
        title: permanent ? `Xóa vĩnh viễn “${item.story.title}”?` : `Xóa “${item.story.title}”?`,
        description: permanent
          ? "Toàn bộ chương và nội dung sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác."
          : "Truyện nháp và toàn bộ chương sẽ bị xóa. Hành động này không thể hoàn tác.",
        confirmText: permanent ? "Xóa vĩnh viễn" : "Xóa truyện",
        variant: "danger",
      });
      if (!accepted) return;
    }

    setBusyStoryId(item.story.id);
    try {
      const base = `/api/stories/${encodeURIComponent(item.story.id)}`;
      if (action === "delete") {
        await commandRequest<null>(base, "DELETE", { expectedUpdatedAt: item.updatedAt });
        setStories((current) => current.filter((candidate) => candidate.story.id !== item.story.id));
      } else {
        const result = await commandRequest<ManagedStory>(`${base}/${ACTION_ENDPOINTS[action]}`, "POST", {
          expectedUpdatedAt: item.updatedAt,
        });
        setStories((current) => current.map((candidate) => candidate.story.id === item.story.id
          ? {
              story: result.data,
              rejectionReason: result.data.status === "rejected" ? candidate.rejectionReason : null,
              updatedAt: result.meta.updatedAt,
            }
          : candidate));
      }
      toast.success(ACTION_SUCCESS[action]);
    } catch (error) {
      const message = friendlyRequestMessage(error, "Không thể cập nhật trạng thái truyện.");
      toast.error(message);
    } finally {
      setBusyStoryId(null);
    }
  };

  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Không gian sáng tác</p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Truyện của tôi</h1>
          <p className="mt-2 max-w-2xl text-[var(--color-muted-foreground)]">Theo dõi bản thảo, hoàn thiện từng chương và gửi tác phẩm tới độc giả.</p>
        </div>
        <Link href="/author/stories/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-primary-foreground)] shadow-md transition-colors hover:bg-[var(--color-primary-hover)]">
          <Plus aria-hidden="true" className="h-4 w-4" /> Tạo truyện mới
        </Link>
      </div>

      {stories.length > 0 ? (
        <div className="mt-8 overflow-x-auto pb-2" role="group" aria-label="Lọc truyện theo trạng thái">
          <div className="flex min-w-max gap-2">
            {TABS.map((tab) => {
              const count = tab.value === "all" ? stories.length : stories.filter((item) => item.story.status === tab.value).length;
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={filter === tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={`min-h-11 cursor-pointer rounded-full border px-4 text-sm font-semibold transition-colors ${filter === tab.value
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                    : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}
                >
                  {tab.label} <span className="ml-1 opacity-75">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <section id="author-story-panel" className="mt-6" aria-label={filter === "all" ? "Tất cả truyện" : TABS.find((tab) => tab.value === filter)?.label}>
        {stories.length === 0 ? (
          <div className="glass-card border border-[var(--color-border)] p-8 text-center sm:p-12">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-accent)]">
              <BookOpen aria-hidden="true" className="h-8 w-8" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold">Bạn chưa có truyện nào</h2>
            <p className="mx-auto mt-2 max-w-md text-[var(--color-muted-foreground)]">Bắt đầu bằng thông tin cơ bản và ít nhất một chương. Bạn có thể viết nội dung ngay sau đó.</p>
            <Link href="/author/stories/new" className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)]">
              <Plus aria-hidden="true" className="h-4 w-4" /> Tạo truyện đầu tiên
            </Link>
          </div>
        ) : visibleStories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center">
            <p className="font-semibold">Chưa có truyện trong mục này.</p>
            <button type="button" onClick={() => setFilter("all")} className="mt-3 min-h-11 cursor-pointer rounded-xl px-4 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-muted)]">Xem tất cả truyện</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleStories.map((item) => (
              <StoryManageCard key={item.story.id} item={item} busy={busyStoryId === item.story.id} onAction={(action, selected) => void runAction(action, selected)} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
