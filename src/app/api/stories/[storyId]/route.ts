// app/api/stories/[storyId]/route.ts
// Phase 2: Route Handler lưu & đọc nội dung truyện (US-2.6)

import { NextRequest, NextResponse } from "next/server";
import { storyRepository } from "@/lib/repositories";
import { Story } from "@/types/story";

interface RouteParams {
  params: Promise<{ storyId: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { storyId } = await params;
    const story = await storyRepository.getById(storyId);

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

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { storyId } = await params;
    const body = (await req.json()) as Story;

    if (!body || !body.id) {
      return NextResponse.json(
        { error: "Invalid story data" },
        { status: 400 }
      );
    }

    // Đảm bảo story.id khớp với param
    body.id = storyId;

    await storyRepository.save(body);

    return NextResponse.json({
      success: true,
      message: "Story saved successfully",
      story: body,
    });
  } catch (error) {
    console.error("Failed to save story:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
