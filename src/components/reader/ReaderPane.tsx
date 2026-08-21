// components/reader/ReaderPane.tsx
"use client";

import React from "react";
import { Chapter } from "@/types/story";

export interface ReaderPaneProps {
  chapter: Chapter;
}

/**
 * Container chính của Reader Screen, quản lý Intersection Observer và trigger hiệu ứng
 */
export default function ReaderPane({ chapter }: ReaderPaneProps) {
  return (
    <main className="reader-pane min-h-screen w-full">
      <h1 className="text-2xl font-bold mb-6">{chapter.title}</h1>
      <div className="blocks-container space-y-4">
        {/* TODO: Phase 1 render StoryBlock[] */}
      </div>
    </main>
  );
}
