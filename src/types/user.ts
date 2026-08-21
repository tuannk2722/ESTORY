// types/user.ts — CHƯA dùng ở Phase 1–2, định nghĩa trước để Phase 3 không đổi shape giữa chừng
export type Role = "reader" | "author" | "admin";

export interface AppUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
  role: Role;
  created_at: string;
}
