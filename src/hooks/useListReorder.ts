"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";

export type DropTarget = { index: number; position: "before" | "after" };

interface UseListReorderOptions {
  itemCount: number;
  onMove(fromIndex: number, toIndex: number): void;
}

export function moveListItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex
    || fromIndex < 0
    || toIndex < 0
    || fromIndex >= items.length
    || toIndex >= items.length
  ) return items as T[];
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function resolveListDropIndex(
  draggedIndex: number,
  target: DropTarget,
  itemCount: number,
): number | null {
  if (
    !Number.isInteger(draggedIndex)
    || !Number.isInteger(target.index)
    || !Number.isInteger(itemCount)
    || itemCount < 1
    || draggedIndex < 0
    || draggedIndex >= itemCount
    || target.index < 0
    || target.index >= itemCount
  ) return null;

  let destination = target.position === "before" ? target.index : target.index + 1;
  if (draggedIndex < destination) destination -= 1;
  return destination === draggedIndex || destination < 0 || destination >= itemCount
    ? null
    : destination;
}

export function useListReorder({ itemCount, onMove }: UseListReorderOptions) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const dragHandleActiveRef = useRef(false);
  const draggedIndexRef = useRef<number | null>(null);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const dragOverFrameRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const pointerYRef = useRef<number | null>(null);

  useEffect(() => {
    const deactivateHandle = () => { dragHandleActiveRef.current = false; };
    window.addEventListener("mouseup", deactivateHandle);
    window.addEventListener("touchend", deactivateHandle);
    return () => {
      window.removeEventListener("mouseup", deactivateHandle);
      window.removeEventListener("touchend", deactivateHandle);
    };
  }, []);

  const resetDragState = useCallback(() => {
    draggedIndexRef.current = null;
    setDraggedIndex(null);
    setDropTarget(null);
    dropTargetRef.current = null;
    dragHandleActiveRef.current = false;
    pointerYRef.current = null;
    if (dragOverFrameRef.current !== null) {
      cancelAnimationFrame(dragOverFrameRef.current);
      dragOverFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (draggedIndex === null) return;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const edgeSize = 120;
    const maxSpeed = 30;
    const handleWindowDragOver = (event: globalThis.DragEvent) => {
      pointerYRef.current = event.clientY;
    };
    const tick = () => {
      const viewportHeight = window.innerHeight;
      let speed = 0;
      if (pointerYRef.current !== null) {
        const y = Math.min(viewportHeight, Math.max(0, pointerYRef.current));
        if (y < edgeSize) {
          speed = -((1 - y / edgeSize) ** 2) * maxSpeed;
        } else if (y > viewportHeight - edgeSize) {
          speed = ((1 - (viewportHeight - y) / edgeSize) ** 2) * maxSpeed;
        }
      }
      if (speed !== 0) window.scrollBy(0, speed);
      scrollFrameRef.current = requestAnimationFrame(tick);
    };
    window.addEventListener("dragover", handleWindowDragOver, true);
    scrollFrameRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver, true);
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [draggedIndex]);

  const handleDragStart = useCallback((event: DragEvent, index: number) => {
    if (!dragHandleActiveRef.current) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    draggedIndexRef.current = index;
    pointerYRef.current = event.clientY;
    setDraggedIndex(index);
  }, []);

  const updateDropTarget = useCallback((nextTarget: DropTarget) => {
    const sourceIndex = draggedIndexRef.current;
    const next = sourceIndex !== null && resolveListDropIndex(sourceIndex, nextTarget, itemCount) !== null
      ? nextTarget
      : null;
    if (
      dropTargetRef.current?.index === next?.index
      && dropTargetRef.current?.position === next?.position
    ) return;

    dropTargetRef.current = next;
    if (next === null) {
      setDropTarget(null);
      return;
    }
    if (dragOverFrameRef.current === null) {
      dragOverFrameRef.current = requestAnimationFrame(() => {
        setDropTarget(dropTargetRef.current);
        dragOverFrameRef.current = null;
      });
    }
  }, [itemCount]);

  const handleDragOverAt = useCallback((
    event: DragEvent,
    targetIndex: number,
    position: DropTarget["position"],
  ) => {
    if (draggedIndexRef.current === null) return;
    event.preventDefault();
    event.stopPropagation();
    updateDropTarget({ index: targetIndex, position });
  }, [updateDropTarget]);

  const handleDragOver = useCallback((event: DragEvent, targetIndex: number) => {
    if (draggedIndexRef.current === null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const position: DropTarget["position"] = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    handleDragOverAt(event, targetIndex, position);
  }, [handleDragOverAt]);

  const handleDrop = useCallback((event: DragEvent) => {
    const sourceIndex = draggedIndexRef.current;
    if (sourceIndex === null) return;
    event.preventDefault();
    event.stopPropagation();
    const target = dropTargetRef.current;
    if (target === null) return resetDragState();
    const destination = resolveListDropIndex(sourceIndex, target, itemCount);
    if (destination !== null) onMove(sourceIndex, destination);
    resetDragState();
  }, [itemCount, onMove, resetDragState]);

  const moveUp = useCallback((index: number) => {
    if (index > 0) onMove(index, index - 1);
  }, [onMove]);
  const moveDown = useCallback((index: number) => {
    if (index < itemCount - 1) onMove(index, index + 1);
  }, [itemCount, onMove]);
  const setDragHandleActive = useCallback((active: boolean) => {
    dragHandleActiveRef.current = active;
  }, []);

  return {
    draggedIndex,
    dropTarget,
    setDragHandleActive,
    handleDragStart,
    handleDragOver,
    handleDragOverAt,
    handleDrop,
    handleDragEnd: resetDragState,
    moveUp,
    moveDown,
  };
}
