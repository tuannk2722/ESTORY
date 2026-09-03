export interface ReaderBlockGeometry {
  id: string;
  top: number;
  bottom: number;
}

export interface ReaderViewportGeometry {
  top: number;
  bottom: number;
  topInset?: number;
}

export const READING_ANCHOR_RATIO = 0.42;
export const ACTIVE_BLOCK_HYSTERESIS_PX = 32;

/**
 * Chọn block quanh vùng nhìn tự nhiên của reader thay vì dựa thuần vào
 * intersectionRatio. Cách tính này không làm block dài bị bất lợi và giữ
 * block hiện tại thêm một khoảng nhỏ ở ranh giới để tránh đổi qua lại.
 */
export function selectActiveReaderBlock(
  blocks: ReaderBlockGeometry[],
  viewport: ReaderViewportGeometry,
  currentBlockId: string | null,
  anchorRatio = READING_ANCHOR_RATIO,
  hysteresisPx = ACTIVE_BLOCK_HYSTERESIS_PX
): string | null {
  if (blocks.length === 0) return null;

  const viewportTop = viewport.top + Math.max(0, viewport.topInset ?? 0);
  const viewportBottom = Math.max(viewportTop + 1, viewport.bottom);
  const viewportHeight = viewportBottom - viewportTop;
  const safeAnchorRatio = Math.min(1, Math.max(0, anchorRatio));
  const anchor = viewportTop + viewportHeight * safeAnchorRatio;

  const current = currentBlockId
    ? blocks.find((block) => block.id === currentBlockId)
    : undefined;
  if (
    current &&
    current.bottom >= viewportTop &&
    current.top <= viewportBottom &&
    anchor >= current.top - hysteresisPx &&
    anchor <= current.bottom + hysteresisPx
  ) {
    return current.id;
  }

  const visibleBlocks = blocks.filter(
    (block) => block.bottom > viewportTop && block.top < viewportBottom
  );
  const candidates = visibleBlocks.length > 0 ? visibleBlocks : blocks;

  let bestId = candidates[0]?.id ?? null;
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((block) => {
    const height = Math.max(1, block.bottom - block.top);
    const visibleHeight = Math.max(
      0,
      Math.min(block.bottom, viewportBottom) - Math.max(block.top, viewportTop)
    );
    // Chuẩn hóa theo phần block tối đa có thể thấy trong viewport. Nhờ vậy
    // paragraph rất dài vẫn có thể đạt visibleRatio = 1.
    const visibleRatio = visibleHeight / Math.min(height, viewportHeight);
    const distance =
      anchor < block.top
        ? block.top - anchor
        : anchor > block.bottom
          ? anchor - block.bottom
          : 0;
    const score = distance / viewportHeight + (1 - visibleRatio) * 0.2;

    if (score < bestScore) {
      bestScore = score;
      bestId = block.id;
    }
  });

  return bestId;
}

export function calculateScrollProgress(
  scrollTop: number,
  scrollHeight: number,
  viewportHeight: number
): number {
  const scrollableHeight = scrollHeight - viewportHeight;
  if (scrollableHeight <= 0) return 0;
  return Math.min(1, Math.max(0, scrollTop / scrollableHeight));
}

export function calculateEffectVolume(
  intensity: number | undefined,
  intensityMultiplier: number | undefined,
  fallbackIntensity = 0.8
): number {
  const base = Number.isFinite(intensity) ? Number(intensity) : fallbackIntensity;
  const multiplier = Number.isFinite(intensityMultiplier)
    ? Number(intensityMultiplier)
    : 1;
  return Math.min(1, Math.max(0, base * multiplier));
}
