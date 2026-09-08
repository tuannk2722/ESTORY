import type { ApiFailure } from "@/types/api";

export class CommandError extends Error {
  readonly body: ApiFailure;
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 503,
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.body = { error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } };
  }
}

export function notFound(): never {
  throw new CommandError(404, "NOT_FOUND", "Resource not found");
}
export function conflict(code = "STALE_UPDATE", message = "Content has changed. Reload before saving."): never {
  throw new CommandError(409, code, message);
}

/** Codes only: never forward ORM messages, query parameters or malformed content. */
export function mapCommandDatabaseError(error: unknown): never {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "P2034" || code === "P2025") conflict();
  if (code === "P2002" || code === "P2003") conflict("CONTENT_CONFLICT", "Content could not be saved. Reload before retrying.");
  throw error;
}
