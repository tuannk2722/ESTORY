"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState } from "react";
import darkArtwork from "../../../public/home-background-image/home-hero-dark.png";
import lightArtwork from "../../../public/home-background-image/home-hero-light.png";
import sepiaArtwork from "../../../public/home-background-image/home-hero-sepia.png";
import {
  readPresentedTheme,
  type ThemeId,
} from "@/lib/theme/theme-presentation";

const ARTWORKS: ReadonlyArray<{ theme: ThemeId; src: StaticImageData }> = [
  { theme: "dark", src: darkArtwork },
  { theme: "light", src: lightArtwork },
  { theme: "sepia", src: sepiaArtwork },
];
const CROSSFADE_MS = 180;

async function waitUntilDecoded(image: HTMLImageElement): Promise<boolean> {
  if (!image.complete) {
    const loaded = await new Promise<boolean>((resolve) => {
      const onLoad = () => { cleanup(); resolve(true); };
      const onError = () => { cleanup(); resolve(false); };
      const cleanup = () => {
        image.removeEventListener("load", onLoad);
        image.removeEventListener("error", onError);
      };
      image.addEventListener("load", onLoad, { once: true });
      image.addEventListener("error", onError, { once: true });
    });
    if (!loaded) return false;
  }
  if (image.naturalWidth === 0) return false;
  try {
    await image.decode();
  } catch {
    // A completely loaded image may reject decode after the browser already decoded it.
  }
  return image.naturalWidth > 0;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export default function HomeHeroArtwork() {
  const images = useRef<Record<ThemeId, HTMLImageElement | null>>({
    dark: null,
    light: null,
    sepia: null,
  });
  const displayedRef = useRef<ThemeId>("dark");
  const transitionRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const [managed, setManaged] = useState(false);
  const [displayed, setDisplayed] = useState<ThemeId>("dark");
  const [incoming, setIncoming] = useState<ThemeId | null>(null);
  const [fadeStarted, setFadeStarted] = useState(false);

  useEffect(() => {
    const initial = readPresentedTheme();
    displayedRef.current = initial;
    const activationFrame = window.requestAnimationFrame(() => {
      setDisplayed(initial);
      setManaged(true);
    });

    async function transitionTo(target: ThemeId) {
      if (target === displayedRef.current) {
        transitionRef.current += 1;
        if (timerRef.current) window.clearTimeout(timerRef.current);
        setIncoming(null);
        setFadeStarted(false);
        return;
      }
      const transition = ++transitionRef.current;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setIncoming(target);
      setFadeStarted(false);
      await nextFrame();
      const image = images.current[target];
      if (!image || !(await waitUntilDecoded(image)) || transition !== transitionRef.current) {
        if (transition === transitionRef.current) setIncoming(null);
        return;
      }
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reducedMotion) {
        displayedRef.current = target;
        setDisplayed(target);
        setIncoming(null);
        return;
      }
      await nextFrame();
      if (transition !== transitionRef.current) return;
      setFadeStarted(true);
      timerRef.current = window.setTimeout(() => {
        if (transition !== transitionRef.current) return;
        displayedRef.current = target;
        setDisplayed(target);
        setIncoming(null);
        setFadeStarted(false);
      }, CROSSFADE_MS);
    }

    const observer = new MutationObserver(() => {
      void transitionTo(readPresentedTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      transitionRef.current += 1;
      window.cancelAnimationFrame(activationFrame);
      observer.disconnect();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      data-managed={managed ? "true" : "false"}
      className="home-hero-artwork pointer-events-none absolute inset-0 overflow-hidden bg-[var(--home-hero-placeholder)]"
    >
      {ARTWORKS.map(({ theme, src }) => {
        const visible = theme === displayed || theme === incoming;
        const opacity = theme === incoming
          ? (fadeStarted ? 1 : 0)
          : theme === displayed
            ? (incoming && fadeStarted ? 0 : 1)
            : 0;
        return (
          <div
            key={theme}
            data-hero-theme={theme}
            data-visible={visible ? "true" : "false"}
            className="home-hero-theme-layer absolute inset-0"
            style={{ opacity: managed ? opacity : 1 }}
          >
            <Image
              ref={(image) => { images.current[theme] = image; }}
              src={src}
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-top"
            />
          </div>
        );
      })}
    </div>
  );
}
