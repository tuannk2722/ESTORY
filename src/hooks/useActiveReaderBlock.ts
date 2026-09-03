"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { selectActiveReaderBlock } from "@/lib/reader/readerMetrics";

const CANDIDATE_ROOT_MARGIN_PX = 240;

function findScrollableAncestor(element: Element): Element | null {
  let parent = element.parentElement;
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return parent;
    parent = parent.parentElement;
  }
  return null;
}

/**
 * Một observer chung theo dõi toàn bộ block. IntersectionObserver chỉ giữ tập
 * ứng viên gần viewport; việc chọn active block diễn ra tối đa một lần/frame
 * theo reading anchor nên ổn định cho cả paragraph ngắn lẫn rất dài.
 */
export function useActiveReaderBlock(
  containerRef: RefObject<HTMLElement | null>,
  blockIds: string[],
  initialBlockId: string | null
): string | null {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(initialBlockId);
  const activeBlockRef = useRef<string | null>(initialBlockId);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!activeBlockRef.current || !blockIds.includes(activeBlockRef.current)) {
      activeBlockRef.current = initialBlockId;
    }

    const elements = Array.from(
      container.querySelectorAll<HTMLElement>("[data-reader-block-id]")
    );
    if (elements.length === 0) return;

    const scrollRoot = findScrollableAncestor(container);
    const candidates = new Set<HTMLElement>();
    let animationFrame = 0;

    const selectBlock = () => {
      animationFrame = 0;
      const rootRect = scrollRoot?.getBoundingClientRect();
      const viewportTop = rootRect?.top ?? 0;
      const viewportBottom = rootRect?.bottom ?? window.innerHeight;
      const readerHeader = scrollRoot
        ? scrollRoot.querySelector<HTMLElement>("[data-reader-header]")
        : document.querySelector<HTMLElement>("[data-reader-header]");
      const topInset = readerHeader
        ? Math.max(0, readerHeader.getBoundingClientRect().bottom - viewportTop)
        : 0;
      const measuredElements = candidates.size > 0 ? [...candidates] : elements;
      const geometries = measuredElements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            id: element.dataset.readerBlockId || element.id,
            top: rect.top,
            bottom: rect.bottom,
          };
        })
        .sort((left, right) => left.top - right.top);
      const nextBlockId = selectActiveReaderBlock(
        geometries,
        { top: viewportTop, bottom: viewportBottom, topInset },
        activeBlockRef.current
      );

      if (nextBlockId && nextBlockId !== activeBlockRef.current) {
        activeBlockRef.current = nextBlockId;
        setActiveBlockId(nextBlockId);
      }
    };

    const scheduleSelection = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(selectBlock);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;
          if (entry.isIntersecting) candidates.add(element);
          else candidates.delete(element);
        });
        scheduleSelection();
      },
      {
        root: scrollRoot,
        rootMargin: `${CANDIDATE_ROOT_MARGIN_PX}px 0px`,
        threshold: 0,
      }
    );

    elements.forEach((element) => observer.observe(element));
    const scrollTarget: EventTarget = scrollRoot ?? window;
    scrollTarget.addEventListener("scroll", scheduleSelection, { passive: true });
    window.addEventListener("resize", scheduleSelection, { passive: true });
    scheduleSelection();

    return () => {
      observer.disconnect();
      scrollTarget.removeEventListener("scroll", scheduleSelection);
      window.removeEventListener("resize", scheduleSelection);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [blockIds, containerRef, initialBlockId]);

  return activeBlockId && blockIds.includes(activeBlockId)
    ? activeBlockId
    : initialBlockId;
}
