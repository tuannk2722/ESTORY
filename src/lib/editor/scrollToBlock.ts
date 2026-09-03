export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface ScrollToBlockOptions {
  reducedMotion?: boolean;
}

export function scrollToEditorBlock(
  blockId: string,
  options: ScrollToBlockOptions = {}
): boolean {
  if (typeof document === "undefined") return false;

  const element = document.getElementById(blockId);
  if (!element) return false;

  element.scrollIntoView({
    behavior: (options.reducedMotion ?? prefersReducedMotion()) ? "auto" : "smooth",
    block: "center",
  });
  return true;
}
