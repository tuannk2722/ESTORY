import { NextRequest, NextResponse } from "next/server";
import { sceneRepository, storyRepository } from "@/lib/repositories";

/** Reader endpoint. Editor mutations go through the validated aggregate route. */
export async function GET(request: NextRequest) {
  try {
    const storyId = request.nextUrl.searchParams.get("storyId");
    const chapterId = request.nextUrl.searchParams.get("chapterId");
    if (!storyId || !chapterId) {
      return NextResponse.json(
        { error: "storyId and chapterId query parameters are required" },
        { status: 400 }
      );
    }

    const story = await storyRepository.getPublicById(storyId);
    const chapter = story?.chapters.find((candidate) => candidate.id === chapterId);
    if (!chapter) {
      return NextResponse.json(
        { error: "Public chapter not found" },
        { status: 404 }
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
