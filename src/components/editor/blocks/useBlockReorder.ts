"use client";

import { useListReorder, type DropTarget } from "@/hooks/useListReorder";

export type { DropTarget };

export function useBlockReorder({
  totalBlocks,
  onMoveBlock,
}: {
  totalBlocks: number;
  onMoveBlock(fromIndex: number, toIndex: number): void;
}) {
  return useListReorder({ itemCount: totalBlocks, onMove: onMoveBlock });
}
