import type { DailyQuota } from "@/types/user";
import { CommandError } from "./command-error";

export type QuotaKind = "freesound_import" | "ai_background";
export interface QuotaStore {
  read(userId: string, kind: QuotaKind, now: Date): Promise<DailyQuota>;
  reserve(userId: string, kind: QuotaKind, now: Date): Promise<{ reserved: boolean; quota: DailyQuota }>;
  refund(userId: string, kind: QuotaKind, resetAt: string): Promise<void>;
}

export function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/** Opaque, request-local capability. Never serialize this context or accept it from a client. */
export interface QuotaReservation {
  readonly quota: DailyQuota;
  commit(): Promise<void>;
  refund(): Promise<void>;
}

export class QuotaService {
  constructor(private readonly store: QuotaStore, private readonly now: () => Date = () => new Date()) {}

  read(userId: string, kind: QuotaKind): Promise<DailyQuota> {
    return this.store.read(userId, kind, this.now());
  }

  async reserve(userId: string, kind: QuotaKind): Promise<QuotaReservation> {
    const result = await this.store.reserve(userId, kind, this.now());
    if (!result.reserved) {
      throw new CommandError(429, "DAILY_QUOTA_EXHAUSTED", "Daily quota exhausted", {
        reset_at: [result.quota.reset_at],
      });
    }
    // Claim the terminal action synchronously, before yielding to any I/O. Repeated or
    // competing settlements share its promise; an ambiguous DB failure is never retried.
    let settlement: Promise<void> | undefined;
    const commit = () => settlement ??= Promise.resolve();
    const refund = () => settlement ??= Promise.resolve().then(
      () => this.store.refund(userId, kind, result.quota.reset_at),
    );
    return Object.freeze({ quota: Object.freeze({ ...result.quota }), commit, refund });
  }
}
