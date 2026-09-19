import type {
  BackgroundRenderSnapshot,
  SceneVisualTreatmentV2,
} from "@/types/scene";
import {
  DEFAULT_SCENE_ACCENT_COLOR,
  SCENE_TREATMENT_DERIVATION_VERSION,
} from "./scene-visual-policy";

export {
  DEFAULT_SCENE_ACCENT_COLOR,
  MAX_SCENE_ATMOSPHERE_OPACITY,
  SCENE_BODY_TEXT_COLOR,
  SCENE_READABILITY_MIN_OPACITY,
  SCENE_READABILITY_SCRIM_RGB,
  SCENE_TREATMENT_DERIVATION_VERSION,
} from "./scene-visual-policy";

const DEFAULT_DERIVATION_TIMEOUT_MS = 5_000;
const SAMPLE_EDGE = 48;
const MAX_PIXEL_SAMPLES = 4_096;

export interface VisualTreatmentPixelBuffer {
  /** RGBA bytes, matching ImageData.data. */
  data: ArrayLike<number>;
  width: number;
  height: number;
}

export interface VisualTreatmentDerivationOptions {
  /** Injection point for tests and media that already has decoded bytes. */
  loadPixels?: (mediaUrl: string) => Promise<VisualTreatmentPixelBuffer>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface HslColor {
  h: number;
  s: number;
  l: number;
}

interface ColorBucket {
  count: number;
  red: number;
  green: number;
  blue: number;
}

export function createOriginalVisualTreatment(
  accentColor = DEFAULT_SCENE_ACCENT_COLOR
): SceneVisualTreatmentV2 {
  return {
    mode: "original",
    accent_color: canonicalHex(accentColor) ?? DEFAULT_SCENE_ACCENT_COLOR,
  };
}

/**
 * Derives a resolved v2 snapshot once in the authoring client. It deliberately
 * returns the original treatment on every decode, CORS, timeout or sampling
 * failure so media selection and saving are never blocked by color analysis.
 */
export async function deriveVisualTreatmentFromBackground(
  background: BackgroundRenderSnapshot,
  options: VisualTreatmentDerivationOptions = {}
): Promise<SceneVisualTreatmentV2> {
  try {
    const data = background.render_data;

    if (data.kind === "gradient" || data.kind === "radial_gradient") {
      const pixels = gradientStopsToPixelBuffer(data.stops);
      return pixels ? deriveVisualTreatmentFromPixels(pixels) : createOriginalVisualTreatment();
    }

    // Registered particle backdrops do not expose a stable source-color
    // contract. Do not inspect their rendered output or poster heuristically.
    if (data.kind === "particle_composition") {
      return createOriginalVisualTreatment();
    }

    const mediaUrl = data.kind === "video" ? background.poster_frame : data.media_url;
    if (!mediaUrl) return createOriginalVisualTreatment();

    const loader = options.loadPixels ?? loadBrowserImagePixels;
    const timeoutMs = clamp(
      Math.round(options.timeoutMs ?? DEFAULT_DERIVATION_TIMEOUT_MS),
      250,
      15_000
    );
    const pixels = await withTimeoutAndAbort(
      loader(mediaUrl),
      timeoutMs,
      options.signal
    );
    return deriveVisualTreatmentFromPixels(pixels);
  } catch {
    return createOriginalVisualTreatment();
  }
}

/** Pure deterministic quantize -> score -> resolved treatment pipeline. */
export function deriveVisualTreatmentFromPixels(
  pixels: VisualTreatmentPixelBuffer
): SceneVisualTreatmentV2 {
  const source = selectSourceColor(pixels);
  if (!source) return createOriginalVisualTreatment();

  const sourceHsl = rgbToHsl(source);
  // Near-neutral media has no meaningful hue. Falling back to Original keeps
  // both accent and atmosphere neutral instead of inventing a red hue from
  // HSL's conventional hue=0 representation for greys.
  if (sourceHsl.s < 0.08) return createOriginalVisualTreatment();
  const accent = readableAccent(sourceHsl);
  const atmosphere = atmosphereColor(sourceHsl);
  const opacity = clamp(roundTo(0.08 + sourceHsl.s * 0.08, 2), 0.08, 0.16);

  return {
    mode: "auto",
    accent_color: rgbToHex(accent),
    atmosphere: {
      color: rgbToHex(atmosphere),
      opacity,
    },
    derivation_version: SCENE_TREATMENT_DERIVATION_VERSION,
  };
}

function selectSourceColor(pixels: VisualTreatmentPixelBuffer): RgbaColor | null {
  const { data, width, height } = pixels;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    data.length < width * height * 4
  ) {
    return null;
  }

  const pixelCount = width * height;
  const stride = Math.max(1, Math.ceil(pixelCount / MAX_PIXEL_SAMPLES));
  const buckets = new Map<number, ColorBucket>();
  let accepted = 0;

  for (let pixel = 0; pixel < pixelCount; pixel += stride) {
    const index = pixel * 4;
    const alpha = finiteByte(data[index + 3]);
    if (alpha < 64) continue;

    const red = finiteByte(data[index]);
    const green = finiteByte(data[index + 1]);
    const blue = finiteByte(data[index + 2]);
    const key = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4);
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
    accepted += 1;
  }

  if (accepted === 0) return null;

  let best: { key: number; score: number; color: RgbaColor } | null = null;
  for (const [key, bucket] of buckets) {
    const color = {
      r: Math.round(bucket.red / bucket.count),
      g: Math.round(bucket.green / bucket.count),
      b: Math.round(bucket.blue / bucket.count),
      a: 255,
    };
    const hsl = rgbToHsl(color);
    const population = bucket.count / accepted;
    const usableTone = 1 - Math.min(1, Math.abs(hsl.l - 0.52) / 0.52);
    const score = Math.sqrt(population) * 0.55 + hsl.s * 0.35 + usableTone * 0.1;

    if (!best || score > best.score || (score === best.score && key < best.key)) {
      best = { key, score, color };
    }
  }

  return best?.color ?? null;
}

function readableAccent(source: HslColor): RgbaColor {
  const candidate = hslToRgb({
    h: source.h,
    s: clamp(Math.max(source.s, 0.5), 0, 0.86),
    l: clamp(source.l, 0.56, 0.72),
  });
  const backdrop = { r: 2, g: 6, b: 23, a: 255 };
  if (contrastRatio(candidate, backdrop) >= 4.5) return candidate;

  for (let amount = 0.08; amount <= 0.48; amount += 0.08) {
    const lighter = mixRgb(candidate, { r: 255, g: 255, b: 255, a: 255 }, amount);
    if (contrastRatio(lighter, backdrop) >= 4.5) return lighter;
  }
  return hexToRgb(DEFAULT_SCENE_ACCENT_COLOR)!;
}

function atmosphereColor(source: HslColor): RgbaColor {
  return hslToRgb({
    h: source.h,
    s: clamp(Math.max(source.s, 0.3), 0, 0.72),
    l: clamp(source.l, 0.28, 0.58),
  });
}

function gradientStopsToPixelBuffer(
  stops: Array<{ color: string; position: number }>
): VisualTreatmentPixelBuffer | null {
  const parsed = stops.map((stop) => ({ ...stop, color: parseCssColor(stop.color) }));
  if (parsed.some((stop) => !stop.color)) return null;

  const data = new Uint8ClampedArray(64 * 4);
  for (let index = 0; index < 64; index += 1) {
    const position = index / 63;
    let rightIndex = parsed.findIndex((stop) => stop.position >= position);
    if (rightIndex < 0) rightIndex = parsed.length - 1;
    const leftIndex = Math.max(0, rightIndex - 1);
    const left = parsed[leftIndex];
    const right = parsed[rightIndex];
    const span = Math.max(0, right.position - left.position);
    const amount = span === 0 ? 0 : clamp((position - left.position) / span, 0, 1);
    const color = mixRgb(left.color!, right.color!, amount);
    const offset = index * 4;
    data[offset] = color.r;
    data[offset + 1] = color.g;
    data[offset + 2] = color.b;
    data[offset + 3] = color.a;
  }
  return { data, width: 64, height: 1 };
}

async function loadBrowserImagePixels(mediaUrl: string): Promise<VisualTreatmentPixelBuffer> {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    throw new Error("Image decoding is unavailable");
  }

  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Unable to decode background media"));
    image.src = mediaUrl;
  });

  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  if (!naturalWidth || !naturalHeight) throw new Error("Decoded image has no pixels");

  const scale = Math.min(1, SAMPLE_EDGE / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D context is unavailable");

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return { data: imageData.data, width, height };
}

function withTimeoutAndAbort<T>(
  task: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(new DOMException("Aborted", "AbortError")));
    const timer = setTimeout(
      () => finish(() => reject(new Error("Visual treatment derivation timed out"))),
      timeoutMs
    );
    signal?.addEventListener("abort", onAbort, { once: true });
    task.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error))
    );
  });
}

function parseCssColor(input: string): RgbaColor | null {
  const value = input.trim().toLowerCase();
  const hex = hexToRgb(value);
  if (hex) return hex;

  const functional = /^(rgba?|hsla?)\(([^()]+)\)$/.exec(value);
  if (functional) {
    const [, name, body] = functional;
    const parts = body.replace(/,/g, " ").replace(/\//g, " ").trim().split(/\s+/);
    if (parts.length === 3 || parts.length === 4) {
      const alpha = parts[3] === undefined ? 255 : parseAlpha(parts[3]);
      if (alpha === null) return null;
      if (name.startsWith("rgb")) {
        const channels = parts.slice(0, 3).map(parseRgbChannel);
        if (channels.some((channel) => channel === null)) return null;
        return { r: channels[0]!, g: channels[1]!, b: channels[2]!, a: alpha };
      }
      const hue = Number.parseFloat(parts[0]);
      const saturation = parsePercentage(parts[1]);
      const lightness = parsePercentage(parts[2]);
      if (!Number.isFinite(hue) || saturation === null || lightness === null) return null;
      return { ...hslToRgb({ h: normalizeHue(hue), s: saturation, l: lightness }), a: alpha };
    }
  }

  const named: Record<string, string> = {
    black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000",
    blue: "#0000ff", yellow: "#ffff00", cyan: "#00ffff", aqua: "#00ffff",
    magenta: "#ff00ff", fuchsia: "#ff00ff", gray: "#808080", grey: "#808080",
    orange: "#ffa500", purple: "#800080", rebeccapurple: "#663399",
    transparent: "#00000000",
  };
  if (named[value]) return hexToRgb(named[value]);

  // The contract already validates CSS named colors. Let the browser normalize
  // the uncommon names while keeping the deterministic parser usable in Node.
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#010203";
      context.fillStyle = value;
      const normalized = context.fillStyle;
      if (normalized !== "#010203") return parseCssColor(normalized);
    }
  }
  return null;
}

function canonicalHex(input: string): string | null {
  const color = hexToRgb(input.trim().toLowerCase());
  return color ? rgbToHex(color) : null;
}

function hexToRgb(input: string): RgbaColor | null {
  const match = /^#([0-9a-f]{3,8})$/i.exec(input);
  if (!match || ![3, 4, 6, 8].includes(match[1].length)) return null;
  const expanded = match[1].length <= 4
    ? [...match[1]].map((character) => character + character).join("")
    : match[1];
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
    a: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) : 255,
  };
}

function parseRgbChannel(token: string): number | null {
  const value = Number.parseFloat(token);
  if (!Number.isFinite(value)) return null;
  return Math.round(clamp(token.endsWith("%") ? value * 2.55 : value, 0, 255));
}

function parseAlpha(token: string): number | null {
  const value = Number.parseFloat(token);
  if (!Number.isFinite(value)) return null;
  return Math.round(clamp(token.endsWith("%") ? value * 2.55 : value * 255, 0, 255));
}

function parsePercentage(token: string): number | null {
  if (!token.endsWith("%")) return null;
  const value = Number.parseFloat(token);
  return Number.isFinite(value) ? clamp(value / 100, 0, 1) : null;
}

function rgbToHex(color: RgbaColor): string {
  const channel = (value: number) => finiteByte(value).toString(16).padStart(2, "0");
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

function rgbToHsl(color: RgbaColor): HslColor {
  const red = color.r / 255;
  const green = color.g / 255;
  const blue = color.b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l: lightness };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === red) hue = 60 * (((green - blue) / delta) % 6);
  else if (max === green) hue = 60 * ((blue - red) / delta + 2);
  else hue = 60 * ((red - green) / delta + 4);
  return { h: normalizeHue(hue), s: saturation, l: lightness };
}

function hslToRgb(color: HslColor): RgbaColor {
  const hue = normalizeHue(color.h);
  const chroma = (1 - Math.abs(2 * color.l - 1)) * color.s;
  const segment = hue / 60;
  const intermediate = chroma * (1 - Math.abs((segment % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;
  if (segment < 1) [red, green] = [chroma, intermediate];
  else if (segment < 2) [red, green] = [intermediate, chroma];
  else if (segment < 3) [green, blue] = [chroma, intermediate];
  else if (segment < 4) [green, blue] = [intermediate, chroma];
  else if (segment < 5) [red, blue] = [intermediate, chroma];
  else [red, blue] = [chroma, intermediate];
  const offset = color.l - chroma / 2;
  return {
    r: Math.round((red + offset) * 255),
    g: Math.round((green + offset) * 255),
    b: Math.round((blue + offset) * 255),
    a: 255,
  };
}

function mixRgb(left: RgbaColor, right: RgbaColor, amount: number): RgbaColor {
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount);
  return {
    r: mix(left.r, right.r),
    g: mix(left.g, right.g),
    b: mix(left.b, right.b),
    a: mix(left.a, right.a),
  };
}

function contrastRatio(left: RgbaColor, right: RgbaColor): number {
  const brighter = Math.max(relativeLuminance(left), relativeLuminance(right));
  const darker = Math.min(relativeLuminance(left), relativeLuminance(right));
  return (brighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: RgbaColor): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return linear(color.r) * 0.2126 + linear(color.g) * 0.7152 + linear(color.b) * 0.0722;
}

function finiteByte(value: number): number {
  return Number.isFinite(value) ? Math.round(clamp(value, 0, 255)) : 0;
}

function normalizeHue(value: number): number {
  return ((value % 360) + 360) % 360;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
