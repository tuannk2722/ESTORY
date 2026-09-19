import type { CompletedMediaUpload } from "@/types/media";
import type { BackgroundRenderSnapshot, PaletteRenderSnapshot } from "@/types/scene";
import type {
  ManagedBackgroundAsset,
  ManagedColorPalette,
} from "@/types/scene-catalog-admin";

export interface BackgroundCatalogPersistenceWrite {
  label: string;
  moodTags: string[];
  render: BackgroundRenderSnapshot;
}
export interface PaletteCatalogPersistenceWrite {
  label: string;
  moodTags: string[];
  colors: PaletteRenderSnapshot;
}

export interface SceneCatalogAdminTransactionalRepository {
  getActorRole(actorId: string): Promise<"reader" | "author" | "admin" | null>;
  getAdminBackgrounds(): Promise<ManagedBackgroundAsset[]>;
  getAdminPalettes(): Promise<ManagedColorPalette[]>;
  getAdminBackground(itemId: string): Promise<ManagedBackgroundAsset | null>;
  getAdminPalette(itemId: string): Promise<ManagedColorPalette | null>;
  claimGlobalBackgroundUpload(
    actorId: string,
    uploadId: string,
    expectedKind: "image" | "video",
    claimedAt: Date,
  ): Promise<CompletedMediaUpload>;
  createBackground(input: BackgroundCatalogPersistenceWrite): Promise<ManagedBackgroundAsset>;
  createPalette(input: PaletteCatalogPersistenceWrite): Promise<ManagedColorPalette>;
  updateBackground(
    itemId: string,
    expectedUpdatedAt: string,
    input: BackgroundCatalogPersistenceWrite,
  ): Promise<ManagedBackgroundAsset>;
  updatePalette(
    itemId: string,
    expectedUpdatedAt: string,
    input: PaletteCatalogPersistenceWrite,
  ): Promise<ManagedColorPalette>;
  transitionBackground(
    itemId: string,
    expectedUpdatedAt: string,
    status: "active" | "archived",
    activatedAt: Date | null,
  ): Promise<ManagedBackgroundAsset>;
  transitionPalette(
    itemId: string,
    expectedUpdatedAt: string,
    status: "active" | "archived",
    activatedAt: Date | null,
  ): Promise<ManagedColorPalette>;
  deleteBackground(itemId: string, expectedUpdatedAt: string): Promise<void>;
  deletePalette(itemId: string, expectedUpdatedAt: string): Promise<void>;
}

export interface SceneCatalogAdminTransactionProvider {
  transaction<T>(
    work: (repository: SceneCatalogAdminTransactionalRepository) => Promise<T>,
  ): Promise<T>;
}
