import type { RefObject } from "react";
import { AlertCircle } from "lucide-react";

export interface SummaryError {
  href: string;
  message: string;
}

export default function FormErrorSummary({
  errors,
  summaryRef,
}: {
  errors: SummaryError[];
  summaryRef: RefObject<HTMLDivElement | null>;
}) {
  if (errors.length === 0) return null;
  return (
    <div
      ref={summaryRef}
      tabIndex={-1}
      role="alert"
      aria-labelledby="form-error-title"
      className="rounded-2xl border border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10 p-4 text-[var(--color-foreground)]"
    >
      <h2 id="form-error-title" className="flex items-center gap-2 font-semibold text-[var(--color-destructive)]">
        <AlertCircle aria-hidden="true" className="h-5 w-5" /> Hãy kiểm tra lại thông tin
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
        {errors.map((error, index) => (
          <li key={`${error.href}-${index}`}><a href={error.href} className="underline decoration-dotted underline-offset-4">{error.message}</a></li>
        ))}
      </ul>
    </div>
  );
}

