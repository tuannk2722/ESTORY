import { AlertCircle } from "lucide-react";
import { effectAdminErrorMessage, EffectAdminRequestError } from "./effectAdminTransport";

export interface FieldError {
  id: string;
  message: string;
}

export function toFieldErrors(error: unknown, fallbackId: string): FieldError[] {
  if (!(error instanceof EffectAdminRequestError) || !error.fieldErrors) {
    return [{ id: fallbackId, message: effectAdminErrorMessage(error) }];
  }
  const aliases: Record<string, string> = {
    label: "effect-label",
    description: "effect-description",
    isActive: "effect-active",
    is_active: "effect-active",
    keyword: fallbackId,
    weight: fallbackId.includes("edit") ? fallbackId.replace("keyword", "weight") : "new-keyword-weight",
  };
  const entries = Object.entries(error.fieldErrors).flatMap(([field, messages]) =>
    messages.map((message) => ({ id: aliases[field] ?? fallbackId, message })),
  );
  return entries.length ? entries : [{ id: fallbackId, message: effectAdminErrorMessage(error) }];
}

export function ErrorSummary({ errors, summaryRef }: { errors: FieldError[]; summaryRef: React.RefObject<HTMLDivElement | null> }) {
  if (errors.length === 0) return null;
  return (
    <div
      ref={summaryRef}
      tabIndex={-1}
      role="alert"
      aria-labelledby="effect-errors-title"
      className="rounded-2xl border border-[var(--color-destructive)]/55 bg-[var(--color-destructive)]/10 p-4"
    >
      <h3 id="effect-errors-title" className="flex items-center gap-2 text-sm font-bold">
        <AlertCircle aria-hidden="true" className="h-4 w-4 text-[var(--color-destructive)]" />
        Có thông tin cần kiểm tra
      </h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {errors.map((error, index) => (
          <li key={`${error.id}-${index}`}>
            <a href={`#${error.id}`} className="underline underline-offset-2">{error.message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InlineError({ id, errors }: { id: string; errors: FieldError[] }) {
  const relevant = errors.filter((error) => error.id === id);
  if (!relevant.length) return null;
  return <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-[var(--color-destructive)]">{relevant[0].message}</p>;
}
