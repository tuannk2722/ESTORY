"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sceneSchema } from "@/lib/scenes/scene-render-config";
import { Story } from "@/types/story";
import { Scene } from "@/types/scene";
import {
  buildBlockIndexMap,
  findSceneOverlap,
  preparePendingSceneRange,
  updateScenesAfterBlockDelete,
  validateBlockMoveAgainstScenes,
  validateSceneRange,
} from "@/lib/scenes/sceneRange";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { useEditorSaver } from "@/hooks/useEditorSaver";
import { useEditor } from "./EditorProvider";

export type CompactEditorPanel = "scenes" | "timeline" | null;

export function useEditorClientController(
  story: Story,
) {
  const { state, commands } = useEditor();
  const confirm = useConfirm();
  const router = useRouter();
  const [compactPanel, setCompactPanel] = useState<CompactEditorPanel>(null);
  const [scenePickerOpen, setScenePickerOpen] = useState(false);
  const [pickerRange, setPickerRange] = useState<{
    startBlockId: string;
    endBlockId: string;
    sceneToEdit?: Scene | null;
  } | null>(null);

  const currentChapter = state.chapter;
  const scenes = state.scenes;
  const isSelectingRange = state.range.status === "selecting";
  const isScenePanelCollapsed = state.scenePanel === "collapsed";
  const closeCompactPanel = useCallback(() => setCompactPanel(null), []);
  const toggleDesktopScenePanel = useCallback(
    () => commands.scenes.togglePanel(),
    [commands.scenes]
  );

  const { isSaving, handleSave } = useEditorSaver({
    storyId: story.id,
    chapter: currentChapter,
    scenes,
    dirty: state.dirty,
    changeVersion: state.changeVersion,
    revision: state.revision,
    onSaveStart: commands.save.startSave,
    onSaveSuccess: commands.save.succeedSave,
    onSaveError: commands.save.failSave,
    onSaveConflict: commands.save.conflictSave,
  });

  const handleReturn = useCallback(async () => {
    if (state.dirty) {
      const approved = await confirm({
        title: "Rời khỏi trang soạn thảo?",
        description: "Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn rời đi?",
        variant: "warning",
        confirmText: "Rời đi (Không lưu)",
        cancelText: "Ở lại tiếp tục",
      });
      if (!approved) return;
    }
    router.push(`/author/stories/${encodeURIComponent(story.id)}`);
  }, [confirm, router, state.dirty, story.id]);

  const openScenePicker = useCallback(
    (startBlockId: string, endBlockId: string, sceneToEdit?: Scene | null) => {
      setPickerRange({ startBlockId, endBlockId, sceneToEdit: sceneToEdit || null });
      setScenePickerOpen(true);
    },
    []
  );
  const closeScenePicker = useCallback(() => {
    setScenePickerOpen(false);
    setPickerRange(null);
  }, []);

  const handleSaveScene = useCallback(
    (scene: Scene) => {
      const indexMap = buildBlockIndexMap(currentChapter.blocks);
      const range = validateSceneRange(scene, indexMap, currentChapter.blocks.length);
      const overlap = findSceneOverlap(scene, scenes, indexMap, scene.id);
      const validSnapshot = sceneSchema.safeParse(scene).success;
      if (
        scene.chapter_id !== currentChapter.id ||
        !range.valid ||
        overlap ||
        !validSnapshot
      ) {
        toast.error("Scene không hợp lệ. Vui lòng kiểm tra lại dải block và tài nguyên.");
        return;
      }
      commands.scenes.upsertScene(scene);
      closeScenePicker();
    },
    [closeScenePicker, commands.scenes, currentChapter, scenes]
  );

  const handleProceedSceneRange = useCallback(() => {
    const result = preparePendingSceneRange(
      state.range.startId,
      state.range.endId,
      currentChapter.blocks,
      scenes
    );
    if (!result.valid) {
      const message =
        result.reason === "OVERLAP"
          ? "Dải block đã chọn bị chồng lấn với một Scene hiện có."
          : result.reason === "BOUNDARY_NOT_FOUND"
            ? "Dải block không còn hợp lệ. Hãy chọn lại điểm bắt đầu và kết thúc."
            : "Hãy chọn block bắt đầu trước khi tiếp tục.";
      toast.error(message);
      return;
    }
    openScenePicker(result.startBlockId, result.endBlockId, null);
    commands.range.cancelRange();
    closeCompactPanel();
  }, [closeCompactPanel, commands.range, currentChapter.blocks, openScenePicker, scenes, state.range]);

  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
      const reconciliation = updateScenesAfterBlockDelete(
        blockId,
        scenes,
        currentChapter.blocks
      );
      if (reconciliation.deletedSceneIds.length > 0) {
        const approved = await confirm({
          title: "Xóa block và Scene liên quan?",
          description: "Block này là nội dung duy nhất của một Scene. Xóa block cũng sẽ xóa Scene đó.",
          variant: "danger",
          confirmText: "Xóa block và Scene",
          cancelText: "Hủy bỏ",
        });
        if (!approved) return;
      }
      commands.blocks.deleteBlock(blockId);
    },
    [commands.blocks, confirm, currentChapter.blocks, scenes]
  );

  const handleMoveBlock = useCallback(
    async (fromIndex: number, toIndex: number) => {
      const validation = validateBlockMoveAgainstScenes(
        fromIndex,
        toIndex,
        currentChapter.blocks,
        scenes
      );
      if (validation.type === "invalid") {
        toast.error(validation.reason);
        return;
      }
      if (validation.type === "membership_change") {
        const approved = await confirm({
          title: "Thay đổi phạm vi Scene?",
          description: validation.message,
          variant: "warning",
          confirmText: "Tiếp tục di chuyển",
          cancelText: "Giữ nguyên",
        });
        if (!approved) return;
      }
      commands.blocks.moveBlock(fromIndex, toIndex);
    },
    [commands.blocks, confirm, currentChapter.blocks, scenes]
  );

  const handleSelectEditorBlock = useCallback(
    (blockId: string | null) => {
      if (isSelectingRange && blockId) commands.range.selectRangeBlock(blockId);
      else commands.blocks.selectActive(blockId);
    },
    [commands.blocks, commands.range, isSelectingRange]
  );

  return {
    state,
    commands,
    currentChapter,
    scenes,
    compactPanel,
    setCompactPanel,
    closeCompactPanel,
    scenePickerOpen,
    pickerRange,
    isSelectingRange,
    isScenePanelCollapsed,
    toggleDesktopScenePanel,
    isSaving,
    handleSave,
    handleReturn,
    openScenePicker,
    closeScenePicker,
    handleSaveScene,
    handleProceedSceneRange,
    handleDeleteBlock,
    handleMoveBlock,
    handleSelectEditorBlock,
  };
}
