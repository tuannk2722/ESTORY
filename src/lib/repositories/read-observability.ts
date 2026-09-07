export type RepositoryReadEvent = Readonly<{
  level: "error" | "warn";
  code: string;
  count: number;
}>;

export interface RepositoryReadObserver {
  report(event: RepositoryReadEvent): void;
}

export const consoleRepositoryReadObserver: RepositoryReadObserver = {
  report(event) {
    const message = "Phase 3 repository read event";
    if (event.level === "error") console.error(message, event);
    else console.warn(message, event);
  },
};

export class RepositoryReadError extends Error {
  constructor(readonly code: string) {
    super(`Repository read failed: ${code}`);
    this.name = "RepositoryReadError";
  }
}

export function failRepositoryRead(
  observer: RepositoryReadObserver,
  code: string,
): never {
  observer.report({ level: "error", code, count: 1 });
  throw new RepositoryReadError(code);
}
