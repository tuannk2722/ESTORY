import { NextRequest, NextResponse } from "next/server";
import { storyRepository } from "@/lib/repositories";

interface RouteParams {
  params: Promise<{ storyId: string }>;
}

/** Public read endpoint. Draft stories are deliberately not exposed here. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { storyId } = await params;
    const story = await storyRepository.getPublicById(storyId);

    if (!story) {
      return NextResponse.json(
        { error: "Story not found", storyId },
        { status: 404 }
      );
    }

    return NextResponse.json(story);
  } catch (error) {
    console.error("Failed to get story:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
