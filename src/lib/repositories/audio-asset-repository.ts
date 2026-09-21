import type { AudioAsset } from "@/types/audio-asset";
export interface AudioAssetRepository {
  getByOwner(ownerId: string): Promise<AudioAsset[]>;
  getById(id: string): Promise<AudioAsset | null>;
}
