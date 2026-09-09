import { readerStateResponseSchema, type GuestImport, type ReaderMutation, type ReaderState } from "./schema";

export class ReaderSyncError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
export interface ReaderStateTransport {
  read(userId: string, signal: AbortSignal): Promise<ReaderState | null>;
  bootstrap(userId: string, guest: GuestImport, signal: AbortSignal): Promise<ReaderState>;
  mutate(input: ReaderMutation, signal: AbortSignal): Promise<ReaderState>;
}
async function request(userId: string, signal: AbortSignal, method = "GET", body?: unknown): Promise<ReaderState | null> {
  const response = await fetch("/api/reader-state", {
    method, credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    headers: { "x-reader-user": userId, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body), keepalive: method === "PATCH" } : {}),
  });
  const json = await response.json();
  if (!response.ok) throw new ReaderSyncError(response.status, typeof json?.error?.code === "string" ? json.error.code : "SYNC_FAILED");
  const data = readerStateResponseSchema.parse(json).data;
  if (data && (data.userId !== userId || data.bookmarks.some((item) => item.user_id !== userId))) throw new ReaderSyncError(409, "ACCOUNT_CHANGED");
  return data;
}
export const readerStateTransport: ReaderStateTransport = {
  read: (userId, signal) => request(userId, signal),
  async bootstrap(userId, guest, signal) {
    const data = await request(userId, signal, "POST", { expectedUserId: userId, guest });
    if (!data) throw new ReaderSyncError(500, "INVALID_RESPONSE");
    return data;
  },
  async mutate(input, signal) {
    const data = await request(input.expectedUserId, signal, "PATCH", input);
    if (!data) throw new ReaderSyncError(500, "INVALID_RESPONSE");
    return data;
  },
};
