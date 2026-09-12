import type { CoverPosition } from "@/types/story";

export const DEFAULT_COVER_POSITION: CoverPosition = Object.freeze({ x: 50, y: 50 });

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, value));
}

export function normalizeCoverPosition(position?: CoverPosition | null): CoverPosition {
  return position
    ? { x: clampPercent(position.x), y: clampPercent(position.y) }
    : { ...DEFAULT_COVER_POSITION };
}

export function coverObjectPosition(position?: CoverPosition | null): string {
  const normalized = normalizeCoverPosition(position);
  return `${normalized.x}% ${normalized.y}%`;
}

export function coverPositionForViewportPoint(
  position: CoverPosition,
  point: { x: number; y: number },
  viewport: { width: number; height: number },
  overflow: { x: number; y: number },
): CoverPosition {
  const normalized = normalizeCoverPosition(position);
  return {
    x: overflow.x < 0.5
      ? normalized.x
      : clampPercent(((overflow.x * normalized.x / 100 + point.x - viewport.width / 2) / overflow.x) * 100),
    y: overflow.y < 0.5
      ? normalized.y
      : clampPercent(((overflow.y * normalized.y / 100 + point.y - viewport.height / 2) / overflow.y) * 100),
  };
}

export function sameCoverPosition(left?: CoverPosition | null, right?: CoverPosition | null): boolean {
  const normalizedLeft = normalizeCoverPosition(left);
  const normalizedRight = normalizeCoverPosition(right);
  return normalizedLeft.x === normalizedRight.x && normalizedLeft.y === normalizedRight.y;
}
