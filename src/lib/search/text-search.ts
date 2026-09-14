const COMBINING_MARKS = /\p{M}+/gu;
const NON_LETTER_OR_NUMBER = /[^\p{L}\p{N}]+/gu;

/** Deterministic, locale-independent normalization shared by client and server search. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(NON_LETTER_OR_NUMBER, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function tokenizeSearchText(value: string): string[] {
  const normalized = normalizeSearchText(value);
  return normalized ? normalized.split(" ") : [];
}

/**
 * Includes both the spaced document and its compact alias so queries such as
 * `dem giong` and `demgiong` match the same title.
 */
export function buildSearchDocument(...values: string[]): string {
  const normalized = normalizeSearchText(values.join(" "));
  if (!normalized) return "";
  const compact = normalized.replaceAll(" ", "");
  return compact === normalized ? normalized : `${normalized} ${compact}`;
}

export function buildStorySearchText(title: string, authorDisplayName: string): string {
  return buildSearchDocument(title, authorDisplayName);
}

/** Accent/case-insensitive AND-token substring matching; intentionally not fuzzy. */
export function matchesSearch(query: string, ...values: string[]): boolean {
  const tokens = tokenizeSearchText(query);
  if (tokens.length === 0) return true;
  const document = buildSearchDocument(...values);
  return tokens.every((token) => document.includes(token));
}

export function compareSearchLabels(left: string, right: string): number {
  return normalizeSearchText(left).localeCompare(normalizeSearchText(right), "en")
    || left.localeCompare(right, "vi");
}
