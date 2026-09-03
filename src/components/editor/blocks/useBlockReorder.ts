// src/components/editor/blocks/useBlockReorder.ts
// Hook encapsulating Drag & Drop lifecycle, smooth auto-scrolling, and keyboard-accessible reordering

"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type DropTarget = { index: number; position: "before" | "after" };

export interface UseBlockReorderOptions {
  totalBlocks: number;
  onMoveBlock: (fromIndex: number, toIndex: number) => void;
}

export function useBlockReorder({
  totalBlocks,
  onMoveBlock,
}: UseBlockReorderOptions) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const dragHandleActiveRef = useRef(false);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const rafDragOverId = useRef<number | null>(null);
  const rafScrollId = useRef<number | null>(null);
  const pointerYRef = useRef<number>(0);

  useEffect(() => {
    const deactivateHandle = () => {
      dragHandleActiveRef.current = false;
    };

    window.addEventListener("mouseup", deactivateHandle);
    window.addEventListener("touchend", deactivateHandle);
    return () => {
      window.removeEventListener("mouseup", deactivateHandle);
      window.removeEventListener("touchend", deactivateHandle);
    };
  }, []);

  const resetDragState = useCallback(() => {
    setDraggedIndex(null);
    setDropTarget(null);
    dropTargetRef.current = null;
    dragHandleActiveRef.current = false;
    if (rafDragOverId.current !== null) {
      cancelAnimationFrame(rafDragOverId.current);
      rafDragOverId.current = null;
    }
  }, []);

  // Auto-scroll khi kéo block sát mép trên hoặc dưới màn hình
  useEffect(() => {
    if (draggedIndex === null) return;

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const EDGE_SIZE = 120; // px
    const MAX_SPEED = 30; // px/frame

    const handleWindowDragOver = (e: DragEvent) => {
      pointerYRef.current = e.clientY;
    };

    const tick = () => {
      const y = pointerYRef.current;
      const viewportHeight = window.innerHeight;
      let speed = 0;

      if (y > 0 && y < EDGE_SIZE) {
        const ratio = 1 - y / EDGE_SIZE;
        speed = -Math.pow(ratio, 2) * MAX_SPEED;
      } else if (y > viewportHeight - EDGE_SIZE) {
        const ratio = 1 - (viewportHeight - y) / EDGE_SIZE;
        speed = Math.pow(ratio, 2) * MAX_SPEED;
      }

      if (speed !== 0) {
        window.scrollBy(0, speed);
      }

      rafScrollId.current = requestAnimationFrame(tick);
    };

    window.addEventListener("dragover", handleWindowDragOver);
    rafScrollId.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      if (rafScrollId.current !== null) {
        cancelAnimationFrame(rafScrollId.current);
        rafScrollId.current = null;
      }
      document.body.style.userSelect = previousUserSelect;
    };
  }, [draggedIndex]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      if (!dragHandleActiveRef.current) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index.toString());
      setDraggedIndex(index);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      if (draggedIndex === null || draggedIndex === targetIndex) {
        if (dropTargetRef.current !== null) {
          dropTargetRef.current = null;
          setDropTarget(null);
        }
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position: "before" | "after" = e.clientY < midY ? "before" : "after";

      if (
        (position === "before" && targetIndex === draggedIndex + 1) ||
        (position === "after" && targetIndex === draggedIndex - 1)
      ) {
        if (dropTargetRef.current !== null) {
          dropTargetRef.current = null;
          setDropTarget(null);
        }
        return;
      }

      dropTargetRef.current = { index: targetIndex, position };

      if (rafDragOverId.current === null) {
        rafDragOverId.current = requestAnimationFrame(() => {
          setDropTarget(dropTargetRef.current);
          rafDragOverId.current = null;
        });
      }
    },
    [draggedIndex]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const finalTarget = dropTargetRef.current;
      if (draggedIndex === null || finalTarget === null) {
        resetDragState();
        return;
      }

      let toIndex =
        finalTarget.position === "before"
          ? finalTarget.index
          : finalTarget.index + 1;

      if (draggedIndex < toIndex) {
        toIndex -= 1;
      }

      if (toIndex >= 0 && toIndex < totalBlocks && toIndex !== draggedIndex) {
        onMoveBlock(draggedIndex, toIndex);
      }

      resetDragState();
    },
    [draggedIndex, totalBlocks, onMoveBlock, resetDragState]
  );

  const handleDragEnd = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

  const setDragHandleActive = useCallback((active: boolean) => {
    dragHandleActiveRef.current = active;
  }, []);

  // Keyboard accessibility reordering
  const moveUp = useCallback(
    (index: number) => {
      if (index > 0) {
        onMoveBlock(index, index - 1);
      }
    },
    [onMoveBlock]
  );

  const moveDown = useCallback(
    (index: number) => {
      if (index < totalBlocks - 1) {
        onMoveBlock(index, index + 1);
      }
    },
    [totalBlocks, onMoveBlock]
  );

  return {
    draggedIndex,
    dropTarget,
    setDragHandleActive,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    moveUp,
    moveDown,
  };
}
