"use client";

import Form from "next/form";
import { LoaderCircle, Search } from "lucide-react";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import SearchInput from "@/components/ui/SearchInput";

function SearchFields({
  q,
  formRef,
}: {
  q: string;
  formRef: React.RefObject<HTMLFormElement | null>;
}) {
  const { pending } = useFormStatus();
  return (
    <>
      <SearchInput
        key={q}
        id="home-story-search"
        name="q"
        label="Tìm truyện"
        defaultValue={q}
        maxLength={100}
        placeholder="Tìm theo tên truyện hoặc tác giả…"
        autoComplete="off"
        aria-controls="home-story-results"
        className="min-w-0 flex-1"
        onClear={() => {
          window.requestAnimationFrame(() => formRef.current?.requestSubmit());
        }}
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 font-ui text-sm font-semibold text-[var(--color-primary-foreground)] shadow-md transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-wait disabled:opacity-75 motion-reduce:transition-none sm:min-w-36"
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <Search aria-hidden="true" className="h-4 w-4" />
        )}
        <span>{pending ? "Đang tìm…" : "Tìm kiếm"}</span>
      </button>
    </>
  );
}

export default function StorySearchForm({ q, genre }: { q: string; genre: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <Form
      ref={formRef}
      action="/"
      scroll={false}
      aria-label="Tìm truyện"
      className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--home-hero-control-surface)] p-2 shadow-lg sm:flex-row"
    >
      {genre ? <input type="hidden" name="genre" value={genre} /> : null}
      <SearchFields q={q} formRef={formRef} />
    </Form>
  );
}
