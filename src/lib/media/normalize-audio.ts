import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { CommandError } from "@/lib/services/command-error";
import { inspectMedia } from "./inspect-media";
import { AUDIO_MAX_BYTES } from "./constants";

/** M4A needs seekable input (including files with moov after mdat).
 * Other audio stays on pipes. Never use provider filenames or network protocols.
 */
export async function normalizeAudio(bytes: Uint8Array): Promise<{ bytes: Uint8Array; durationMs: number }> {
  if (!ffmpegPath) throw new CommandError(503, "AUDIO_TRANSCODER_UNAVAILABLE", "Audio transcoding is unavailable");
  const executable = ffmpegPath;
  if (bytes.length === 0 || bytes.length > 64 * 1024 * 1024) throw new CommandError(413, "AUDIO_TOO_LARGE", "Audio input exceeds the import limit");
  const isM4a = bytes.length >= 12 && Buffer.from(bytes.subarray(4, 8)).toString("ascii") === "ftyp";
  const directory = isM4a ? await mkdtemp(join(tmpdir(), "story-audio-")) : null;
  const inputPath = directory ? join(directory, "input.m4a") : null;
  try {
    if (inputPath) await writeFile(inputPath, bytes, { flag: "wx", mode: 0o600 });
    const output = await new Promise<Buffer>((resolve, reject) => {
      const child = spawn(executable, [
        "-hide_banner", "-loglevel", "error", "-nostdin", "-threads", "1",
        "-protocol_whitelist", inputPath ? "file,pipe" : "pipe",
        "-format_whitelist", inputPath ? "mov" : "wav,mp3,ogg,flac,aiff,aac",
        ...(inputPath ? ["-enable_drefs", "0", "-use_absolute_path", "0"] : []),
        "-i", inputPath ?? "pipe:0", "-map", "0:a:0", "-vn", "-sn", "-dn",
        "-map_metadata", "-1", "-t", "301", "-ac", "2", "-ar", "44100", "-codec:a", "libmp3lame",
        "-b:a", "128k", "-threads", "1", "-write_xing", "0", "-f", "mp3", "pipe:1",
      ], { windowsHide: true, stdio: ["pipe", "pipe", "ignore"], shell: false });
      const parts: Buffer[] = [];
      let size = 0;
      let failure: CommandError | undefined;
      const timeout = setTimeout(() => {
        failure = new CommandError(503, "AUDIO_TRANSCODE_TIMEOUT", "Audio conversion took too long"); child.kill("SIGKILL");
      }, 45_000);
      child.stdout.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > AUDIO_MAX_BYTES) { failure = new CommandError(413, "AUDIO_TOO_LARGE", "Converted audio exceeds the limit"); child.kill("SIGKILL"); }
        else parts.push(chunk);
      });
      child.on("error", () => { clearTimeout(timeout); reject(new CommandError(503, "AUDIO_TRANSCODER_UNAVAILABLE", "Audio converter could not start")); });
      child.on("close", (code) => {
        clearTimeout(timeout);
        if (failure || code !== 0 || !size) reject(failure ?? new CommandError(400, "INVALID_AUDIO", "This audio file could not be converted"));
        else resolve(Buffer.concat(parts));
      });
      child.stdin.on("error", () => { /* Early decoder exit is handled by close. */ });
      child.stdin.end(inputPath ? undefined : bytes);
    });
    try {
      const metadata = inspectMedia("audio/mpeg", output);
      if (!metadata.durationMs) throw new Error("Missing duration");
      return { bytes: output, durationMs: metadata.durationMs };
    } catch { throw new CommandError(400, "INVALID_AUDIO", "Converted audio must be playable and at most five minutes long"); }
  } finally {
    if (inputPath && directory) {
      // Only our fixed file and unique directory; cleanup also runs after decoder errors.
      try { await unlink(inputPath); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      await rmdir(directory);
    }
  }
}
