import { normalizeAudio } from "@/lib/media/normalize-audio";
import { performance } from "node:perf_hooks";
import { stat } from "node:fs/promises";
import ffmpegPath from "ffmpeg-static";

export async function audioTranscodeSpike() {
  // Near worst-case duration, stereo PCM at 48 kHz; generated fixture, no user media.
  const dataSize = 48_000 * 2 * 2 * 299;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(48_000, 24); wav.writeUInt32LE(192_000, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(dataSize, 40);
  for (let i = 44; i < wav.length; i += 2) wav.writeInt16LE(Math.round(Math.sin(i / 43) * 5000), i);
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const result = await normalizeAudio(wav);
    runs.push({ elapsedMs: Math.round(performance.now() - start), outputBytes: result.bytes.length, durationMs: result.durationMs });
  }
  return { platform: process.platform, arch: process.arch, node: process.version, binaryBytes: ffmpegPath ? (await stat(ffmpegPath)).size : 0, inputBytes: wav.length, rssBytes: process.memoryUsage().rss, runs };
}
if (process.argv[1]?.endsWith("run-typescript-tests.cjs") && process.argv[2]?.endsWith("spike-audio-transcode.ts")) {
  audioTranscodeSpike().then((result) => console.log(JSON.stringify(result))).catch((e: unknown) => { console.error("Audio transcode spike failed", e instanceof Error ? e.message : "unknown"); process.exitCode = 1; });
}
