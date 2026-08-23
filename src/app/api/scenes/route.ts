// app/api/scenes/route.ts
// Phase 2: Route Handler CRUD Scene theo chapter (US-2.7, US-2.8)

import { NextRequest, NextResponse } from "next/server";
import { sceneRepository } from "@/lib/repositories";
import { Scene } from "@/types/scene";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chapterId = searchParams.get("chapterId");

    if (!chapterId) {
      return NextResponse.json(
        { error: "chapterId query parameter is required" },
        { status: 400 }
      );
    }

    const scenes = await sceneRepository.getByChapterId(chapterId);
    return NextResponse.json(scenes);
  } catch (error) {
    console.error("Failed to get scenes:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Scene;

    if (!body || !body.id || !body.chapter_id || !body.start_block_id || !body.end_block_id) {
      return NextResponse.json(
        { error: "Invalid scene data: id, chapter_id, start_block_id, end_block_id are required" },
        { status: 400 }
      );
    }

    await sceneRepository.save(body);

    return NextResponse.json({
      success: true,
      message: "Scene saved successfully",
      scene: body,
    });
  } catch (error) {
    console.error("Failed to save scene:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sceneId = searchParams.get("sceneId");

    if (!sceneId) {
      return NextResponse.json(
        { error: "sceneId query parameter is required" },
        { status: 400 }
      );
    }

    await sceneRepository.delete(sceneId);

    return NextResponse.json({
      success: true,
      message: "Scene deleted successfully",
      sceneId,
    });
  } catch (error) {
    console.error("Failed to delete scene:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
