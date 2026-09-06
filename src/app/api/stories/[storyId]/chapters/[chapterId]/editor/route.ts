// src/app/api/stories/[storyId]/chapters/[chapterId]/editor/route.ts
// Route Handler for Chapter Editor Aggregate Snapshot (PUT / GET)

import { NextRequest, NextResponse } from "next/server";
import { storyRepository, sceneRepository } from "@/lib/repositories";
import { requireRole } from "@/lib/auth/guards";
import { AuthAccessError } from "@/lib/auth/policy";
import { serverEnv } from "@/lib/env";
import {
  createEditorRevision,
  saveEditorSnapshot,
  type EditorSnapshot,
} from "@/services/editorService";

interface RouteParams {
  params: Promise<{ storyId: string; chapterId: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    // Temporary legacy boundary: ownership arrives with P3-06 commands.
    await requireRole("admin");
    const { storyId, chapterId } = await params;
    const [story, scenes] = await Promise.all([
      storyRepository.getById(storyId),
      sceneRepository.getLegacyByChapter(storyId, chapterId),
    ]);

    if (!story) {
      return NextResponse.json(
        { error: "Story not found" },
        { status: 404 }
      );
    }

    const chapter = story.chapters.find((c) => c.id === chapterId);
    if (!chapter) {
      return NextResponse.json(
        { error: "Chapter not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      chapter,
      scenes: scenes || [],
      revision: createEditorRevision(chapter, scenes || []),
    });
  } catch (error) {
    if (error instanceof AuthAccessError) return NextResponse.json(error.body, { status: error.status });
    console.error("Failed to get editor snapshot:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    await requireRole("admin");
    // Auth.js protects its own POSTs; this content mutation needs its own origin check.
    if (req.headers.get("origin") !== new URL(serverEnv.AUTH_URL!).origin) throw new AuthAccessError(403);
    const { storyId, chapterId } = await params;
    const body: unknown = await req.json();

    if (
      !body ||
      typeof body !== "object" ||
      !("chapter" in body) ||
      !("scenes" in body) ||
      !Array.isArray(body.scenes) ||
      !("revision" in body) ||
      typeof body.revision !== "string" ||
      !body.revision
    ) {
      return NextResponse.json(
        { error: "Invalid snapshot data: chapter, scenes and revision are required" },
        { status: 400 }
      );
    }

    const result = await saveEditorSnapshot(
      storyId,
      chapterId,
      body as EditorSnapshot
    );

    if (!result.success) {
      if (result.conflict) {
        return NextResponse.json(
          {
            error: "Editor snapshot conflict",
            errors: result.errors,
            revision: result.revision,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Validation failed", errors: result.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      revision: result.revision,
    });
  } catch (error) {
    if (error instanceof AuthAccessError) return NextResponse.json(error.body, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_JSON", message: "Invalid JSON body" } }, { status: 400 });
    console.error("Failed to save editor snapshot:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
