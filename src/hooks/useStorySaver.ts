// hooks/useStorySaver.ts
// Phase 2: Custom hook quản lý save story qua API Route Handler (US-2.6)
"use client";

import { useState } from "react";
import { Story } from "@/types/story";
import { toast } from "sonner";

export interface UseStorySaverReturn {
  isSaving: boolean;
  handleSave: (story: Story) => Promise<void>;
}

export function useStorySaver(): UseStorySaverReturn {
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Lưu nội dung truyện qua Route Handler (US-2.6)
  // Implementation Phase 2: JsonStoryRepository (ghi đè file JSON, chỉ chạy ở local dev)
  // Phase 3: swap sang PrismaStoryRepository mà không cần sửa hook này
  const handleSave = async (story: Story) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(story),
      });

      if (!res.ok) {
        throw new Error("Lỗi khi lưu truyện.");
      }

      toast.success("Đã lưu nội dung thành công!");
    } catch {
      toast.error("Không thể lưu truyện. Vui lòng thử lại.", {
        duration: 6000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return { isSaving, handleSave };
}
