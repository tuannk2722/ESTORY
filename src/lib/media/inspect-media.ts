import { Buffer } from "node:buffer";
import { AUDIO_MAX_DURATION_MS } from "./constants";
import type { AcceptedMediaContentType } from "./constants";

export interface InspectedMedia {
  width?: number;
  height?: number;
  durationMs?: number;
}

export class MediaInspectionError extends Error {}

function fail(message: string): never {
  throw new MediaInspectionError(message);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return Buffer.from(bytes.subarray(start, start + length)).toString("ascii");
}

function validDimensions(width: number, height: number): InspectedMedia {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || width > 16_384 || height > 16_384) fail("Invalid image dimensions");
  return { width, height };
}

function inspectJpeg(bytes: Uint8Array): InspectedMedia {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) fail("Invalid JPEG signature");
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    if (offset + 2 > bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 7) fail("Invalid JPEG dimensions");
      return validDimensions((bytes[offset + 5] << 8) | bytes[offset + 6], (bytes[offset + 3] << 8) | bytes[offset + 4]);
    }
    offset += length;
  }
  return fail("JPEG dimensions were not found in the inspection window");
}

function inspectPng(bytes: Uint8Array): InspectedMedia {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)
    || ascii(bytes, 12, 4) !== "IHDR") fail("Invalid PNG signature");
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return validDimensions(view.readUInt32BE(16), view.readUInt32BE(20));
}

function inspectWebp(bytes: Uint8Array): InspectedMedia {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") fail("Invalid WebP signature");
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunk = ascii(bytes, offset, 4);
    const chunkSize = view.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (chunk === "VP8X" && data + 10 <= bytes.length) {
      const width = 1 + bytes[data + 4] + (bytes[data + 5] << 8) + (bytes[data + 6] << 16);
      const height = 1 + bytes[data + 7] + (bytes[data + 8] << 8) + (bytes[data + 9] << 16);
      return validDimensions(width, height);
    }
    if (chunk === "VP8 " && data + 10 <= bytes.length
      && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      return validDimensions(view.readUInt16LE(data + 6) & 0x3fff, view.readUInt16LE(data + 8) & 0x3fff);
    }
    if (chunk === "VP8L" && data + 5 <= bytes.length && bytes[data] === 0x2f) {
      const bits = view.readUInt32LE(data + 1);
      return validDimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
    }
    offset = data + chunkSize + (chunkSize % 2);
  }
  return fail("Unsupported WebP payload");
}

const mpeg1Bitrates = {
  3: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
} as const;
const mpeg2Bitrates = {
  3: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  1: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
} as const;

function inspectMp3(bytes: Uint8Array): InspectedMedia {
  let offset = 0;
  if (bytes.length >= 10 && ascii(bytes, 0, 3) === "ID3") {
    offset = 10 + ((bytes[6] & 0x7f) << 21) + ((bytes[7] & 0x7f) << 14) + ((bytes[8] & 0x7f) << 7) + (bytes[9] & 0x7f);
  }
  let duration = 0;
  let frames = 0;
  while (offset + 4 <= bytes.length) {
    const header = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    if ((header & 0xffe00000) !== 0xffe00000) { offset += frames ? bytes.length : 1; continue; }
    const versionBits = (header >>> 19) & 3;
    const layerBits = (header >>> 17) & 3;
    const bitrateIndex = (header >>> 12) & 15;
    const sampleIndex = (header >>> 10) & 3;
    if (versionBits === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 15 || sampleIndex === 3) {
      if (frames) break;
      offset += 1;
      continue;
    }
    const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 2.5;
    const layer = layerBits as 1 | 2 | 3;
    const bitrateTable = version === 1 ? mpeg1Bitrates[layer] : mpeg2Bitrates[layer];
    const bitrate = bitrateTable[bitrateIndex] * 1000;
    const sampleRate = [44_100, 48_000, 32_000][sampleIndex] / (version === 1 ? 1 : version === 2 ? 2 : 4);
    const padding = (header >>> 9) & 1;
    const samples = layer === 3 ? 384 : layer === 2 || version === 1 ? 1152 : 576;
    const frameLength = layer === 3
      ? Math.floor((12 * bitrate / sampleRate) + padding) * 4
      : Math.floor(((layer === 1 && version !== 1 ? 72 : 144) * bitrate / sampleRate) + padding);
    if (frameLength < 4 || offset + frameLength > bytes.length) break;
    duration += samples / sampleRate;
    frames += 1;
    offset += frameLength;
  }
  if (!frames || duration <= 0) fail("Invalid MP3 frames");
  return { durationMs: Math.max(1, Math.round(duration * 1000)) };
}

function inspectWav(bytes: Uint8Array): InspectedMedia {
  if (bytes.length < 44 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") fail("Invalid WAV signature");
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= bytes.length) {
    const chunk = ascii(bytes, offset, 4);
    const size = view.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (chunk === "fmt " && size >= 16 && data + 16 <= bytes.length) byteRate = view.readUInt32LE(data + 8);
    if (chunk === "data") { dataSize = Math.min(size, Math.max(0, bytes.length - data)); break; }
    offset = data + size + (size % 2);
  }
  if (!byteRate || !dataSize) fail("Invalid WAV metadata");
  return { durationMs: Math.max(1, Math.round(dataSize / byteRate * 1000)) };
}

function inspectOgg(bytes: Uint8Array): InspectedMedia {
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let sampleRate = 0;
  let preSkip = 0;
  let lastGranule = BigInt(0);
  while (offset + 27 <= bytes.length) {
    if (ascii(bytes, offset, 4) !== "OggS" || bytes[offset + 4] !== 0) fail("Invalid Ogg page");
    const segments = bytes[offset + 26];
    if (offset + 27 + segments > bytes.length) fail("Invalid Ogg segment table");
    let bodySize = 0;
    for (let index = 0; index < segments; index += 1) bodySize += bytes[offset + 27 + index];
    const body = offset + 27 + segments;
    if (body + bodySize > bytes.length) fail("Incomplete Ogg page");
    if (!sampleRate && bodySize >= 16 && ascii(bytes, body, 8) === "OpusHead") {
      sampleRate = 48_000;
      preSkip = view.readUInt16LE(body + 10);
    } else if (!sampleRate && bodySize >= 16 && bytes[body] === 1 && ascii(bytes, body + 1, 6) === "vorbis") {
      sampleRate = view.readUInt32LE(body + 12);
    }
    const granule = view.readBigUInt64LE(offset + 6);
    if (granule !== BigInt("18446744073709551615")) lastGranule = granule;
    offset = body + bodySize;
  }
  if (!sampleRate || lastGranule <= BigInt(preSkip)) fail("Invalid Ogg duration metadata");
  return { durationMs: Math.max(1, Math.round(Number(lastGranule - BigInt(preSkip)) / sampleRate * 1000)) };
}

export function inspectMedia(contentType: AcceptedMediaContentType, bytes: Uint8Array): InspectedMedia {
  let result: InspectedMedia;
  switch (contentType) {
    case "image/jpeg": result = inspectJpeg(bytes); break;
    case "image/png": result = inspectPng(bytes); break;
    case "image/webp": result = inspectWebp(bytes); break;
    case "audio/mpeg": result = inspectMp3(bytes); break;
    case "audio/wav":
    case "audio/x-wav": result = inspectWav(bytes); break;
    case "audio/ogg": result = inspectOgg(bytes); break;
    case "video/mp4":
      if (bytes.length < 12 || ascii(bytes, 4, 4) !== "ftyp") fail("Invalid MP4 signature");
      result = {};
      break;
    case "video/webm":
      if (bytes.length < 4 || bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) fail("Invalid WebM signature");
      result = {};
      break;
  }
  if (result.durationMs !== undefined && result.durationMs > AUDIO_MAX_DURATION_MS) fail("Audio duration exceeds the limit");
  return result;
}
