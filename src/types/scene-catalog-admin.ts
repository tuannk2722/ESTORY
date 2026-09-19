import type {
  BackgroundAsset,
  BackgroundRenderSnapshot,
  BackgroundType,
  CatalogStatus,
  ColorPalette,
  PaletteRenderSnapshot,
} from "@/types/scene";

export type SceneCatalogStatusFilter = CatalogStatus | "all";
export type BackgroundTypeFilter = BackgroundType | "all";
export type BackgroundMotionFilter = BackgroundRenderSnapshot["motion"] | "all";

export interface SceneCatalogImpact {
  dependency_count: null;
  provenance: "snapshot_only";
  saved_scenes_unchanged: true;
  storage_cleanup: "separate";
}

export interface ManagedBackgroundAsset extends BackgroundAsset {
  created_at: string;
  updated_at: string;
  can_hard_delete: boolean;
  impact: SceneCatalogImpact;
}

export interface ManagedColorPalette extends ColorPalette {
  created_at: string;
  updated_at: string;
  can_hard_delete: boolean;
  impact: SceneCatalogImpact;
}

export interface BackgroundAdminListQuery {
  q: string;
  type: BackgroundTypeFilter;
  motion: BackgroundMotionFilter;
  status: SceneCatalogStatusFilter;
  cursor: string | null;
}

export interface PaletteAdminListQuery {
  q: string;
  status: SceneCatalogStatusFilter;
  cursor: string | null;
}

export interface SceneCatalogAdminCapabilities {
  can_create: boolean;
  can_edit: boolean;
  can_activate: boolean;
  can_archive: boolean;
  hard_delete_never_activated_only: boolean;
}

export interface BackgroundAdminList {
  items: ManagedBackgroundAsset[];
  total: number;
  nextCursor: string | null;
  capabilities: SceneCatalogAdminCapabilities;
}

export interface PaletteAdminList {
  items: ManagedColorPalette[];
  total: number;
  nextCursor: string | null;
  capabilities: SceneCatalogAdminCapabilities;
}

export interface SceneCatalogDeletionResult {
  id: string;
  impact: SceneCatalogImpact;
}

export type BackgroundAdminRenderInput =
  | { kind: "image"; uploadId?: string }
  | { kind: "video"; uploadId?: string }
  | {
      kind: "gradient";
      angleDeg: number;
      stops: Array<{ color: string; position: number }>;
    }
  | {
      kind: "radial_gradient";
      shape: "circle" | "ellipse";
      center: { x: number; y: number };
      stops: Array<{ color: string; position: number }>;
    }
  | {
      kind: "particle_composition";
      compositionKey: string;
      config: Record<string, unknown>;
      motion: "static" | "looping";
      posterUploadId?: string;
    };

export interface BackgroundCatalogWrite {
  label: string;
  moodTags: string[];
  render: BackgroundAdminRenderInput;
}

export interface PaletteCatalogWrite {
  label: string;
  moodTags: string[];
  colors: PaletteRenderSnapshot;
}

export interface BackgroundCatalogCreate extends BackgroundCatalogWrite {
  render:
    | { kind: "image"; uploadId: string }
    | { kind: "video"; uploadId: string }
    | Exclude<BackgroundAdminRenderInput, { kind: "image" | "video" }>;
}

export interface BackgroundCatalogUpdate extends BackgroundCatalogWrite {
  expectedUpdatedAt: string;
}

export interface PaletteCatalogUpdate extends PaletteCatalogWrite {
  expectedUpdatedAt: string;
}
