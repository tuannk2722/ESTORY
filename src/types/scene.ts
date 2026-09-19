import type { EffectConfig } from './story';

export type CatalogStatus = 'draft' | 'active' | 'archived';
export type BackgroundScope = 'global' | 'personal';
export type BackgroundSource = 'admin_upload' | 'author_upload' | 'ai_generated';
export type BackgroundRenderData =
  | { kind: 'image'; media_url: string }
  | { kind: 'video'; media_url: string }
  | { kind: 'gradient'; angle_deg: number; stops: Array<{ color: string; position: number }> }
  | { kind: 'radial_gradient'; shape: 'circle' | 'ellipse'; center: { x: number; y: number }; stops: Array<{ color: string; position: number }> }
  | { kind: 'particle_composition'; composition_key: string; config: Record<string, unknown> };
export type BackgroundType = BackgroundRenderData['kind'];

export interface BackgroundRenderSnapshot {
  render_data: BackgroundRenderData;
  motion: 'static' | 'looping';
  poster_frame?: string;
}
export interface PaletteRenderSnapshot {
  primary: string;
  secondary: string;
  accent: string;
  background_tint: { color: string; opacity: number };
}

/** Legacy snapshot contract. Its rendering semantics must remain unchanged. */
export interface SceneRenderConfigV1 {
  schema_version: 1;
  background: BackgroundRenderSnapshot;
  palette: PaletteRenderSnapshot;
  ambient_effects: EffectConfig[];
}

export type SceneVisualTreatmentV2 =
  | {
      mode: 'original';
      /** Resolved, canonical lowercase #rrggbb used for reader accents. */
      accent_color: string;
    }
  | {
      mode: 'auto';
      /** Resolved snapshot values. The reader never analyzes background media. */
      accent_color: string;
      atmosphere: { color: string; opacity: number };
      derivation_version: 1;
    };

export interface SceneRenderConfigV2 {
  schema_version: 2;
  background: BackgroundRenderSnapshot;
  visual_treatment: SceneVisualTreatmentV2;
  ambient_effects: EffectConfig[];
}

export type SceneRenderConfig = SceneRenderConfigV1 | SceneRenderConfigV2;
export interface BackgroundAsset {
  id: string;
  label: string;
  render: BackgroundRenderSnapshot;
  mood_tags: string[];
  status: CatalogStatus;
  activated_at?: string;
  scope: BackgroundScope;
  owner_id?: string;
  source: BackgroundSource;
  generation_prompt?: string;
}
export interface ColorPalette {
  id: string;
  label: string;
  colors: PaletteRenderSnapshot;
  mood_tags: string[];
  status: CatalogStatus;
  activated_at?: string;
}
export interface ScenePreset {
  id: string;
  label: string;
  description?: string;
  thumbnail_url?: string;
  mood_tags: string[];
  status: CatalogStatus;
  activated_at?: string;
  /** Compatibility-only presets remain v1 and cannot create v2 scenes. */
  render_config: SceneRenderConfigV1;
}
export interface Scene {
  id: string;
  chapter_id: string;
  start_block_id: string;
  end_block_id: string;
  based_on_preset_id?: string;
  render_config: SceneRenderConfig;
}
export type SceneV1 = Omit<Scene, 'render_config'> & {
  render_config: SceneRenderConfigV1;
};
export interface SceneLibraryData {
  backgrounds: BackgroundAsset[];
  palettes: ColorPalette[];
  scenePresets: ScenePreset[];
}

/** Background-first catalog DTO for Scene authoring v2. */
export interface SceneAuthoringLibraryData {
  backgrounds: BackgroundAsset[];
}
