// types/user.ts — CHƯA dùng ở Phase 1–2, định nghĩa trước để Phase 3 không đổi shape giữa chừng
export type Role = "reader" | "author" | "admin";

/** Client-safe projection; OAuth credentials never belong in AppUser. */
export interface FreesoundConnectionStatus {
  connected: boolean;
  freesound_username?: string;
}

export interface DailyQuota {
  limit: number;
  used: number;
  reset_at: string;
}

export interface AppUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
  role: Role;
  freesound_connection: FreesoundConnectionStatus;
  freesound_import_quota: DailyQuota;
  ai_background_quota: DailyQuota;
  created_at: string;
}
