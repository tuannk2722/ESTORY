import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { normalizeAudio } from "@/lib/media/normalize-audio";
import { CommandError } from "@/lib/services/command-error";

async function run() {
  assert.ok(ffmpegPath);
  const binary = ffmpegPath;
  const dir = await mkdtemp(join(tmpdir(), "audio-fixtures-"));
  const before = (await readdir(tmpdir())).filter((name) => name.startsWith("story-audio-")).sort();
  const files: string[] = [];
  async function fixture(name: string, args: string[], duration = 2) {
    const path = join(dir, name);
    files.push(path);
    execFileSync(binary, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", String(duration), ...args, path], { windowsHide: true, timeout: 30_000 });
    return readFile(path);
  }
  const invalid = (error: unknown) => error instanceof CommandError && error.body.error.code === "INVALID_AUDIO";
  try {
    const tail = await fixture("tail.m4a", ["-c:a", "aac"]);
    assert.ok(tail.indexOf(Buffer.from("moov")) > tail.indexOf(Buffer.from("mdat")), "Fixture requires seeking back to audio data");
    const front = await fixture("front.m4a", ["-c:a", "aac", "-movflags", "+faststart"]);
    assert.ok(front.indexOf(Buffer.from("moov")) < front.indexOf(Buffer.from("mdat")));
    const formats = [tail, front,
      await fixture("raw.aac", ["-c:a", "aac", "-f", "adts"]),
      await fixture("original.wav", ["-c:a", "pcm_s16le"]),
      await fixture("original.mp3", ["-c:a", "libmp3lame"]),
      await fixture("original.ogg", ["-c:a", "libvorbis"]),
      await fixture("original.flac", ["-c:a", "flac"]),
      await fixture("original.aiff", ["-c:a", "pcm_s16be"]),
    ];
    for (const bytes of formats) {
      const result = await normalizeAudio(bytes);
      assert.ok(result.durationMs >= 1900 && result.durationMs < 2200);
      assert.ok(result.bytes.length > 1000 && result.bytes.length <= 8 * 1024 * 1024);
      // Decode the generated MP3 again to verify playback, not just its header.
      execFileSync(binary, ["-v", "error", "-f", "mp3", "-i", "pipe:0", "-f", "null", "-"], { input: result.bytes, windowsHide: true, timeout: 10_000 });
    }
    await Promise.all([normalizeAudio(tail), normalizeAudio(front)]);
    await assert.rejects(normalizeAudio(tail.subarray(0, 40)), invalid);
    await assert.rejects(normalizeAudio(Buffer.from("not audio")), invalid);
    await assert.rejects(normalizeAudio(Buffer.from("#EXTM3U\nhttps://example.com/audio.aac")), invalid);
    await assert.rejects(normalizeAudio(Buffer.alloc(64 * 1024 * 1024 + 1)), (error: unknown) => error instanceof CommandError && error.status === 413);
    await assert.rejects(normalizeAudio(await fixture("long.m4a", ["-c:a", "aac"], 301)), invalid);
    const nearLimit = await normalizeAudio(await fixture("near-limit.m4a", ["-c:a", "aac"], 299));
    assert.ok(nearLimit.durationMs > 298_000 && nearLimit.durationMs <= 300_000);
    assert.deepEqual((await readdir(tmpdir())).filter((name) => name.startsWith("story-audio-")).sort(), before, "Temporary inputs cleaned after success, failure and concurrent imports");
    console.log("Audio transcode: M4A tail/front moov, AAC, five legacy formats, playback, concurrency, invalid input, limits and cleanup passed");
  } finally {
    for (const path of files) await unlink(path).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
    await rmdir(dir);
  }
}

run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
