import type { PrismaClient } from "@/generated/prisma/client";
import { databaseJson } from "@/lib/db/json-fields";
import { SCENE_CATALOG_ADMIN_PAGE_SIZE } from "@/lib/validation/scene-catalog-schema";

/** Give each integration suite its own page boundary, even on an empty CI database. */
export async function seedSceneCatalogPaginationFixtures(
  prisma: PrismaClient,
  marker: string,
  backgroundCount: number,
) {
  const backgroundIds = Array.from({ length: backgroundCount }, (_, index) => `${marker}-page-background-${index}`);
  const paletteIds = Array.from({ length: SCENE_CATALOG_ADMIN_PAGE_SIZE + 1 }, (_, index) => `${marker}-page-palette-${index}`);
  const render = databaseJson.backgroundRender.write({
    render_data: { kind: "gradient", angle_deg: 180, stops: [
      { color: "#172554", position: 0 }, { color: "#020617", position: 1 },
    ] },
    motion: "static",
  });

  await prisma.$transaction([
    prisma.backgroundAsset.createMany({ data: backgroundIds.map((id) => ({
      id, label: `Pagination ${id}`, render, moodTags: [],
    })) }),
    prisma.colorPalette.createMany({ data: paletteIds.map((id) => ({
      id, label: `Pagination ${id}`, primary: "#8B5CF6", secondary: "#0EA5E9",
      accent: "#F59E0B", backgroundTintColor: "#0F172A", moodTags: [],
    })) }),
  ]);

  return { backgroundIds, paletteIds };
}
