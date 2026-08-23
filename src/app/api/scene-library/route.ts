// app/api/scene-library/route.ts
// Phase 2: Route Handler nạp 4 thư viện mẫu Scene (US-2.7, US-2.8)

import { NextResponse } from "next/server";
import { sceneLibraryRepository } from "@/lib/repositories";

export async function GET() {
  try {
    const [backgrounds, palettes, layouts, scenePresets] = await Promise.all([
      sceneLibraryRepository.getBackgrounds(),
      sceneLibraryRepository.getPalettes(),
      sceneLibraryRepository.getLayouts(),
      sceneLibraryRepository.getScenePresets(),
    ]);

    return NextResponse.json({
      backgrounds,
      palettes,
      layouts,
      scenePresets,
    });
  } catch (error) {
    console.error("Failed to load scene library:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
