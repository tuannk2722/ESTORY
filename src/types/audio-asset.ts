export interface AudioAsset {
  id: string;
  owner_id: string;
  source: "freesound" | "upload";
  title: string;
  url: string;
  duration_ms: number;
  freesound_id?: string;
  license?: string;
  attribution?: { author_name: string; source_url: string; license_name: string };
  created_at: string;
}
