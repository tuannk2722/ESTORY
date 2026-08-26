// hooks/useSceneManager.ts
// Phase 2: Custom hook quản lý Scene state + CRUD cho 1 chapter (US-2.7, US-2.8)
// Tách ra từ EditorClient để giữ component nhẹ và đơn nhiệm (09-non-functional-requirements.md)
"use client";

import { useState, useEffect, useCallback } from "react";
import { Scene } from "@/types/scene";
import { Chapter } from "@/types/story";
import { toast } from "sonner";

export interface ScenePickerRange {
  startBlockId: string;
  endBlockId: string;
  sceneToEdit?: Scene | null;
}

export interface UseSceneManagerReturn {
  // State
  scenes: Scene[];
  scenePickerOpen: boolean;
  pickerRange: ScenePickerRange;
  // Actions
  openScenePicker: (
    startBlockId: string,
    endBlockId: string,
    sceneToEdit?: Scene | null
  ) => void;
  closeScenePicker: () => void;
  handleSaveScene: (scene: Scene) => Promise<void>;
  handleDeleteScene: (sceneId: string) => Promise<void>;
  fetchScenes: () => Promise<void>;
}

export function useSceneManager(
  currentChapter: Chapter | null
): UseSceneManagerReturn {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scenePickerOpen, setScenePickerOpen] = useState<boolean>(false);
  const [pickerRange, setPickerRange] = useState<ScenePickerRange>({
    startBlockId: "",
    endBlockId: "",
    sceneToEdit: null,
  });

  // Nạp danh sách Scene của chapter hiện tại từ API
  const fetchScenes = useCallback(async () => {
    if (!currentChapter) return;
    try {
      const res = await fetch(`/api/scenes?chapterId=${currentChapter.id}`);
      if (res.ok) {
        const data = await res.json();
        setScenes(data || []);
      }
    } catch (err) {
      console.error("Failed to load scenes for chapter:", err);
    }
  }, [currentChapter]);

  useEffect(() => {
    fetchScenes();
  }, [fetchScenes]);

  // Mở modal ScenePicker — dùng trong Timeline khi author chọn dải block (US-2.7)
  const openScenePicker = (
    startBlockId: string,
    endBlockId: string,
    sceneToEdit?: Scene | null
  ) => {
    setPickerRange({
      startBlockId,
      endBlockId,
      sceneToEdit: sceneToEdit || null,
    });
    setScenePickerOpen(true);
  };

  const closeScenePicker = () => {
    setScenePickerOpen(false);
  };

  // Lưu Scene với optimistic UI + rollback khi thất bại (US-2.7, US-2.8)
  const handleSaveScene = async (scene: Scene) => {
    // Optimistic update
    const existingIdx = scenes.findIndex((s) => s.id === scene.id);
    let updatedScenes: Scene[];
    if (existingIdx >= 0) {
      updatedScenes = [...scenes];
      updatedScenes[existingIdx] = scene;
    } else {
      updatedScenes = [...scenes, scene];
    }
    setScenes(updatedScenes);

    try {
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scene),
      });

      if (!res.ok) {
        throw new Error("Lỗi khi lưu Scene.");
      }

      toast.success("Đã lưu Scene thành công!");
    } catch (err) {
      console.error(err);
      toast.error("Không thể lưu Scene. Đang hoàn tác.");
      // Rollback về server state
      await fetchScenes();
    }
  };

  // Xóa Scene với optimistic UI + rollback khi thất bại
  const handleDeleteScene = async (sceneId: string) => {
    // Optimistic remove
    setScenes((prev) => prev.filter((s) => s.id !== sceneId));

    try {
      const res = await fetch(`/api/scenes?sceneId=${sceneId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Lỗi khi xóa Scene.");
      }

      toast.success("Đã xóa Scene khỏi dải block.");
    } catch (err) {
      console.error(err);
      toast.error("Không thể xóa Scene.");
      // Rollback về server state
      await fetchScenes();
    }
  };

  return {
    scenes,
    scenePickerOpen,
    pickerRange,
    openScenePicker,
    closeScenePicker,
    handleSaveScene,
    handleDeleteScene,
    fetchScenes,
  };
}
