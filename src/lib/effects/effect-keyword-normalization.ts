/** Canonical form shared by seed, admin uniqueness checks, and runtime matching. */
export function normalizeEffectKeyword(input: string): string {
  return input
    .normalize("NFKC")
    .toLocaleLowerCase("vi-VN")
    .trim()
    .replace(/\s+/gu, " ");
}
