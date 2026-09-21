import type { AudioAsset } from "@/types/audio-asset";
import type { QuotaService } from "./quota-service";
import { CommandError } from "./command-error";

export interface ImportSound { id: number; name: string; username: string; url: string; license: string; duration: number; filesize?: number }
export interface AudioImportDependencies {
  quota: QuotaService;
  find(ownerId: string, soundId: string): Promise<AudioAsset | null>;
  sound(soundId: string): Promise<ImportSound>;
  token(ownerId: string): Promise<string>;
  download(soundId: number, token: string): Promise<Uint8Array>;
  normalize(bytes: Uint8Array): Promise<{ bytes: Uint8Array; durationMs: number }>;
  save(ownerId: string, sound: ImportSound, audio: { bytes: Uint8Array; durationMs: number }): Promise<AudioAsset>;
}

export class AudioImportService {
  constructor(private readonly deps: AudioImportDependencies) {}
  async import(ownerId: string, soundId: string): Promise<AudioAsset> {
    const existing = await this.deps.find(ownerId, soundId);
    if (existing) return existing;
    const reservation = await this.deps.quota.reserve(ownerId, "freesound_import");
    let saving = false;
    try {
      const token = await this.deps.token(ownerId);
      const sound = await this.deps.sound(soundId);
      if (sound.duration > 300 || (sound.filesize ?? 0) > 64 * 1024 * 1024) throw new CommandError(413, "AUDIO_TOO_LARGE", "Sound exceeds import size or duration limits");
      const audio = await this.deps.normalize(await this.deps.download(sound.id, token));
      saving = true;
      const asset = await this.deps.save(ownerId, sound, audio);
      await reservation.commit();
      return asset;
    } catch (error) {
      if (saving) {
        // A lost DB acknowledgement is not proof of rollback. Reconcile before refund.
        let recovered: AudioAsset | null;
        try { recovered = await this.deps.find(ownerId, soundId); }
        catch { await reservation.commit(); throw error; }
        if (recovered) {
          if (error instanceof CommandError && error.body.error.code === "AUDIO_ALREADY_IMPORTED") await reservation.refund();
          else await reservation.commit();
          return recovered;
        }
      }
      await reservation.refund();
      throw error;
    }
  }
}
