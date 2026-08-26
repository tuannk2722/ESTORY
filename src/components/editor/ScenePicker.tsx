// components/editor/ScenePicker.tsx
// Phase 2: Author Editor - Chọn ScenePreset hoặc tự phối Scene cho 1 dải block (US-2.7, US-2.8, docs/08-effects-and-scenes.md)
"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Scene,
  ScenePreset,
  BackgroundAsset,
  ColorPalette,
} from "@/types/scene";
import { StoryBlock, EffectConfig, EffectType } from "@/types/story";
import {
  Layers,
  Sparkles,
  Palette,
  Music,
  Volume2,
  VolumeX,
  Play,
  Square,
  Check,
  X,
  Sliders,
  Film,
  Image as ImageIcon,
  CheckCircle2,
  Eye,
  ArrowLeft,
  Ban,
  ChevronDown,
  Repeat,
  Search,
  Plus,
  Trash2,
  Settings2,
} from "lucide-react";
import { Howl } from "howler";
import SceneBackground from "@/components/scenes/SceneBackground";
import SceneAmbientAudio from "@/components/scenes/SceneAmbientAudio";
import { EFFECT_REGISTRY } from "@/components/effects/EffectRegistry";
import SearchInput, { matchesSearch } from "@/components/ui/SearchInput";
import SearchableCombobox, { type ComboboxOption } from "@/components/ui/SearchableCombobox";
import { EFFECT_METADATA, AUDIO_EFFECT_PRESETS, getEffectIcon } from "./effect-meta";

export interface ScenePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveScene: (scene: Scene) => void;
  chapterId: string;
  startBlockId: string;
  endBlockId: string;
  blocks: StoryBlock[];
  initialScene?: Scene | null;
}

// Số lượng preset / background hiển thị ban đầu
const INITIAL_PRESET_LIMIT = 10;
const INITIAL_BACKGROUND_LIMIT = 6;

export default function ScenePicker({
  isOpen,
  onClose,
  onSaveScene,
  chapterId,
  startBlockId,
  endBlockId,
  blocks,
  initialScene,
}: ScenePickerProps) {
  // Library state
  const [loading, setLoading] = useState<boolean>(true);
  const [backgrounds, setBackgrounds] = useState<BackgroundAsset[]>([]);
  const [palettes, setPalettes] = useState<ColorPalette[]>([]);
  const [presets, setPresets] = useState<ScenePreset[]>([]);

  // Selection mode: "preset" | "custom"
  const [mode, setMode] = useState<"preset" | "custom">(
    initialScene?.based_on_preset_id ? "preset" : initialScene ? "custom" : "preset"
  );

  // Form state
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    initialScene?.based_on_preset_id || null
  );
  const [backgroundId, setBackgroundId] = useState<string>(
    initialScene?.background_id || ""
  );
  const [paletteId, setPaletteId] = useState<string>(
    initialScene?.palette_id || ""
  );
  const [ambientAudioSrc, setAmbientAudioSrc] = useState<string>("");
  const [ambientVolume, setAmbientVolume] = useState<number>(0.5);
  const [configuredEffects, setConfiguredEffects] = useState<EffectConfig[]>([]);
  const [isLoop, setIsLoop] = useState<boolean>(true);

  // Search states (Collapsible search - default false)
  const [presetSearchOpen, setPresetSearchOpen] = useState<boolean>(false);
  const [presetSearch, setPresetSearch] = useState<string>("");

  const [bgSearchOpen, setBgSearchOpen] = useState<boolean>(false);
  const [bgSearch, setBgSearch] = useState<string>("");

  // Load-more pagination states
  const [presetVisibleCount, setPresetVisibleCount] = useState<number>(INITIAL_PRESET_LIMIT);
  const [bgVisibleCount, setBgVisibleCount] = useState<number>(INITIAL_BACKGROUND_LIMIT);

  // Live Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isPreviewMuted, setIsPreviewMuted] = useState<boolean>(false);
  const [previewActiveEffects, setPreviewActiveEffects] = useState<Record<string, boolean>>({});

  // Audio preview playback state (small card audition)
  const [playingAudioSrc, setPlayingAudioSrc] = useState<string | null>(null);
  const previewHowlRef = useRef<Howl | null>(null);

  // Quản lý timer hiển thị của Live Preview cho các effect có loop === false
  useEffect(() => {
    if (!isPreviewOpen || configuredEffects.length === 0) {
      setPreviewActiveEffects({});
      return;
    }

    const timers: NodeJS.Timeout[] = [];
    const initialMap: Record<string, boolean> = {};

    configuredEffects.forEach((eff, idx) => {
      const effKey = eff.id || `${eff.type}-${idx}`;
      const delay = eff.delay_ms && eff.delay_ms > 0 ? eff.delay_ms : 0;
      const isLoopEff = eff.loop !== false;
      const meta = EFFECT_METADATA[eff.type];
      const duration =
        eff.duration_ms && eff.duration_ms > 0
          ? eff.duration_ms
          : meta?.defaultDurationMs || 3500;

      if (delay > 0) {
        const startTimer = setTimeout(() => {
          setPreviewActiveEffects((prev) => ({ ...prev, [effKey]: true }));
        }, delay);
        timers.push(startTimer);
      } else {
        initialMap[effKey] = true;
      }

      if (!isLoopEff) {
        const stopTimer = setTimeout(() => {
          setPreviewActiveEffects((prev) => ({ ...prev, [effKey]: false }));
        }, delay + duration);
        timers.push(stopTimer);
      }
    });

    setPreviewActiveEffects(initialMap);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isPreviewOpen, configuredEffects]);

  // Editing single effect parameters via popover
  const [editingEffectId, setEditingEffectId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const section3Ref = useRef<HTMLDivElement>(null);
  const badgeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Dynamically calculate and clamp popover position so it NEVER overflows or clips
  const updatePopoverPosition = useCallback(() => {
    if (!editingEffectId || !section3Ref.current) {
      setPopoverPos(null);
      return;
    }

    const badgeEl = badgeRefs.current[editingEffectId];
    const containerEl = section3Ref.current;
    if (!badgeEl || !containerEl) return;

    const badgeRect = badgeEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();

    const popoverWidth = Math.min(330, containerRect.width - 24);
    let left = badgeRect.left - containerRect.left;

    // Clamp left so popover is always 100% inside container bounds
    if (left + popoverWidth > containerRect.width - 12) {
      left = containerRect.width - popoverWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    const top = badgeRect.bottom - containerRect.top + 8;

    setPopoverPos({ top, left, width: popoverWidth });
  }, [editingEffectId]);

  // Recalculate popover position on edit or resize
  useEffect(() => {
    if (!editingEffectId) {
      setPopoverPos(null);
      return;
    }

    // Measure after DOM paint
    const animId = requestAnimationFrame(() => {
      updatePopoverPosition();
    });

    window.addEventListener("resize", updatePopoverPosition);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", updatePopoverPosition);
    };
  }, [editingEffectId, updatePopoverPosition]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!editingEffectId) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !Object.values(badgeRefs.current).some((el) => el?.contains(e.target as Node))
      ) {
        setEditingEffectId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingEffectId]);

  // Helper to extract audio and particle effects array
  const extractEffectsState = (effects?: EffectConfig[]) => {
    const audio = effects?.find((e) => e.type === "audio" || e.category === "audio");
    const nonAudioEffects: EffectConfig[] =
      effects
        ?.filter((e) => e.type !== "audio" && e.category !== "audio")
        .map((e, idx) => {
          const meta = EFFECT_METADATA[e.type];
          return {
            id: e.id || `fx-${e.type}-${Date.now()}-${idx}`,
            type: e.type,
            category: e.category || meta?.category || "visual",
            intensity: e.intensity ?? meta?.defaultIntensity ?? 0.75,
            duration_ms: e.duration_ms ?? meta?.defaultDurationMs ?? 0,
            delay_ms: e.delay_ms ?? 0,
            loop: e.loop ?? true,
          };
        }) || [];

    const firstEffect = effects?.[0];

    return {
      audioSrc: audio?.audio_src || "",
      volume: audio?.intensity ?? 0.5,
      effects: nonAudioEffects,
      loop: firstEffect?.loop ?? true,
    };
  };

  // Fetch library data
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function fetchLibrary() {
      try {
        setLoading(true);
        const res = await fetch("/api/scene-library");
        if (!res.ok) throw new Error("Failed to fetch scene library");
        const data = await res.json();
        if (mounted) {
          setBackgrounds(data.backgrounds || []);
          setPalettes(data.palettes || []);
          setPresets(data.scenePresets || []);

          // Set values based on initialScene if editing, otherwise keep unselected
          if (initialScene) {
            setMode(initialScene.based_on_preset_id ? "preset" : "custom");
            setSelectedPresetId(initialScene.based_on_preset_id || null);
            setBackgroundId(initialScene.background_id || "");
            setPaletteId(initialScene.palette_id || "");
            const { audioSrc, volume, effects, loop } = extractEffectsState(initialScene.effects);
            setAmbientAudioSrc(audioSrc);
            setAmbientVolume(volume);
            setConfiguredEffects(effects);
            setIsLoop(loop);
          } else {
            // Khi tạo mới scene cho 1 dải block: KHÔNG tự động chọn trước preset, bối cảnh hay bảng màu nào
            setMode("preset");
            setSelectedPresetId(null);
            setBackgroundId("");
            setPaletteId("");
            setAmbientAudioSrc("");
            setAmbientVolume(0.5);
            setConfiguredEffects([]);
            setIsLoop(true);
          }
        }
      } catch (err) {
        console.error("Error fetching scene library:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchLibrary();

    return () => {
      mounted = false;
      stopAudioPreview();
      setIsPreviewOpen(false);
    };
  }, [isOpen, initialScene]);

  // Audio preview helper for card sample
  const toggleAudioPreview = (src: string) => {
    if (!src) return;

    if (playingAudioSrc === src && previewHowlRef.current) {
      stopAudioPreview();
      return;
    }

    stopAudioPreview();
    const sound = new Howl({
      src: [src],
      html5: true,
      volume: 0.6,
      onend: () => setPlayingAudioSrc(null),
    });
    previewHowlRef.current = sound;
    sound.play();
    setPlayingAudioSrc(src);
  };

  const stopAudioPreview = () => {
    if (previewHowlRef.current) {
      previewHowlRef.current.stop();
      previewHowlRef.current.unload();
      previewHowlRef.current = null;
    }
    setPlayingAudioSrc(null);
  };

  // Preset selection handler (Copy, không tham chiếu sống)
  const handleSelectPreset = (preset: ScenePreset) => {
    setSelectedPresetId(preset.id);
    setBackgroundId(preset.background_id);
    setPaletteId(preset.palette_id);
    const { audioSrc, volume, effects, loop } = extractEffectsState(preset.effects);
    setAmbientAudioSrc(audioSrc);
    setAmbientVolume(volume);
    setConfiguredEffects(effects);
    setIsLoop(loop);
  };

  // Quick preview a preset directly
  const handleQuickPreviewPreset = (e: React.MouseEvent, preset: ScenePreset) => {
    e.stopPropagation();
    handleSelectPreset(preset);
    stopAudioPreview();
    setIsPreviewOpen(true);
  };

  // Open Preview for current configuration
  const handleOpenPreview = () => {
    stopAudioPreview();
    setIsPreviewOpen(true);
  };

  // Add an effect from dropdown
  const handleAddEffect = (type: string) => {
    if (type === "none") {
      setConfiguredEffects([]);
      setEditingEffectId(null);
      setSelectedPresetId(null);
      return;
    }

    const existing = configuredEffects.find((e) => e.type === type);
    if (existing) {
      setEditingEffectId(existing.id);
      return;
    }

    const meta = EFFECT_METADATA[type as EffectType];
    const newEffect: EffectConfig = {
      id: `fx-${type}-${Date.now()}`,
      type: type as EffectType,
      category: meta?.category || "visual",
      intensity: meta?.defaultIntensity ?? 0.75,
      duration_ms: meta?.defaultDurationMs ?? 0,
      delay_ms: 0,
      loop: isLoop,
    };

    setConfiguredEffects((prev) => [...prev, newEffect]);
    setEditingEffectId(newEffect.id);
    setSelectedPresetId(null);
  };

  // Update specific param of an effect
  const handleUpdateEffectParam = (id: string, field: keyof EffectConfig, value: any) => {
    setConfiguredEffects((prev) =>
      prev.map((eff) => (eff.id === id ? { ...eff, [field]: value } : eff))
    );
    setSelectedPresetId(null);
  };

  // Commit and save parameter adjustments when clicking "Xong"
  const handleCommitEffectEdit = (id: string) => {
    setConfiguredEffects((prev) =>
      prev.map((eff) => {
        if (eff.id !== id) return eff;
        return {
          ...eff,
          intensity: Math.min(1.0, Math.max(0.1, Number((eff.intensity ?? 0.75).toFixed(2)))),
          duration_ms: Math.max(0, Math.round(eff.duration_ms ?? 0)),
          delay_ms: Math.max(0, Math.round(eff.delay_ms ?? 0)),
          loop: eff.loop ?? true,
        };
      })
    );
    setEditingEffectId(null);
    setSelectedPresetId(null);
  };

  // Remove single effect
  const handleRemoveEffect = (id: string) => {
    setConfiguredEffects((prev) => prev.filter((eff) => eff.id !== id));
    if (editingEffectId === id) setEditingEffectId(null);
    setSelectedPresetId(null);
  };

  // Clear all effects
  const handleClearAllEffects = () => {
    setConfiguredEffects([]);
    setEditingEffectId(null);
    setSelectedPresetId(null);
  };

  // Submit handler
  const handleSave = () => {
    const sceneEffects: EffectConfig[] = [];

    if (ambientAudioSrc && ambientAudioSrc.trim() !== "") {
      sceneEffects.push({
        id: `fx-audio-${Date.now()}`,
        type: "audio",
        category: "audio",
        intensity: ambientVolume,
        duration_ms: 0,
        audio_src: ambientAudioSrc.trim(),
        loop: isLoop,
      });
    }

    configuredEffects.forEach((eff) => {
      sceneEffects.push({
        ...eff,
        intensity: Number((eff.intensity ?? 0.75).toFixed(2)),
        duration_ms: eff.duration_ms ?? 0,
        delay_ms: eff.delay_ms ?? 0,
        loop: eff.loop ?? true,
      });
    });

    const scene: Scene = {
      id: initialScene?.id || `scene-${Date.now().toString().slice(-6)}`,
      chapter_id: chapterId,
      start_block_id: startBlockId,
      end_block_id: endBlockId,
      based_on_preset_id: mode === "preset" ? selectedPresetId || undefined : undefined,
      background_id: backgroundId,
      palette_id: paletteId,
      effects: sceneEffects.length > 0 ? sceneEffects : undefined,
    };

    stopAudioPreview();
    setIsPreviewOpen(false);
    onSaveScene(scene);
    onClose();
  };

  if (!isOpen) return null;

  // Resolve start and end block index numbers for friendly display
  const startIndex = blocks.findIndex((b) => b.id === startBlockId);
  const endIndex = blocks.findIndex((b) => b.id === endBlockId);
  const rangeLabel =
    startIndex >= 0 && endIndex >= 0
      ? `Đoạn #${startIndex + 1} → #${endIndex + 1} (${endIndex - startIndex + 1} blocks)`
      : `Dải block đã chọn`;

  // Selected story blocks for preview
  const selectedBlocks = useMemo(() => {
    if (startIndex === -1 || endIndex === -1) return blocks.slice(0, 4);
    const minIdx = Math.min(startIndex, endIndex);
    const maxIdx = Math.max(startIndex, endIndex);
    return blocks.slice(minIdx, maxIdx + 1);
  }, [blocks, startIndex, endIndex]);

  // Resolve active preview assets
  const activeBackgroundAsset = backgrounds.find((b) => b.id === backgroundId);
  const activeColorPalette = palettes.find((p) => p.id === paletteId);
  const activePresetObject = presets.find((p) => p.id === selectedPresetId);

  const previewSceneLabel =
    mode === "preset" && activePresetObject
      ? activePresetObject.label
      : "Bối Cảnh Tự Phối";

  const firstParagraphId = selectedBlocks.find((b) => b.type === "paragraph")?.id;

  // Validation: kiểm tra đã chọn đầy đủ thông tin để lưu hoặc xem trước chưa
  const isSaveDisabled =
    mode === "preset"
      ? !selectedPresetId || !backgroundId || !paletteId
      : !backgroundId || !paletteId;

  // ── Initial scene target IDs (Chỉ tính dựa trên initialScene khi mở modal edit) ──
  const initialPresetId = useMemo(() => {
    if (!initialScene) return null;
    if (initialScene.based_on_preset_id) return initialScene.based_on_preset_id;
    const matched = presets.find(
      (p) =>
        p.background_id === initialScene.background_id &&
        p.palette_id === initialScene.palette_id
    );
    return matched ? matched.id : null;
  }, [initialScene, presets]);

  const initialBgId = initialScene?.background_id || null;
  const initialPalId = initialScene?.palette_id || null;

  // ── Filtered & paginated data ──
  // Đưa mục ban đầu của scene cần edit lên đầu danh sách khi mở modal.
  // Khi người dùng click chọn trong modal, giữ nguyên vị trí danh sách (không tự nhảy lên đầu).

  const filteredPresets = useMemo(() => {
    let list = presetSearch
      ? presets.filter((p) => matchesSearch(presetSearch, p.label, ...p.mood_tags))
      : [...presets];

    // Chỉ đưa preset ban đầu của scene đang EDIT lên đầu danh sách
    if (initialPresetId) {
      const idx = list.findIndex((p) => p.id === initialPresetId);
      if (idx > 0) {
        const [activeItem] = list.splice(idx, 1);
        list.unshift(activeItem);
      }
    }
    return list;
  }, [presets, presetSearch, initialPresetId]);

  const visiblePresets = presetSearch
    ? filteredPresets
    : filteredPresets.slice(0, presetVisibleCount);
  const hasMorePresets = !presetSearch && presetVisibleCount < filteredPresets.length;

  const filteredBackgrounds = useMemo(() => {
    let list = bgSearch
      ? backgrounds.filter((bg) => matchesSearch(bgSearch, bg.label, bg.type, bg.motion || ""))
      : [...backgrounds];

    // Chỉ đưa bối cảnh nền ban đầu của scene đang EDIT lên đầu danh sách
    if (initialBgId) {
      const idx = list.findIndex((bg) => bg.id === initialBgId);
      if (idx > 0) {
        const [activeItem] = list.splice(idx, 1);
        list.unshift(activeItem);
      }
    }
    return list;
  }, [backgrounds, bgSearch, initialBgId]);

  const visibleBackgrounds = bgSearch
    ? filteredBackgrounds
    : filteredBackgrounds.slice(0, bgVisibleCount);
  const hasMoreBackgrounds = !bgSearch && bgVisibleCount < filteredBackgrounds.length;

  // ── Combobox options (Đưa bảng màu ban đầu của scene đang edit lên đầu) ──

  const paletteComboboxOptions: ComboboxOption[] = useMemo(() => {
    let list = [...palettes];
    // Chỉ đưa bảng màu ban đầu của scene đang EDIT lên đầu danh sách
    if (initialPalId) {
      const idx = list.findIndex((p) => p.id === initialPalId);
      if (idx > 0) {
        const [activeItem] = list.splice(idx, 1);
        list.unshift(activeItem);
      }
    }

    return list.map((pal) => ({
      id: pal.id,
      label: pal.label,
      searchTexts: [pal.label],
      renderOption: () => (
        <div className="flex items-center gap-2.5 w-full">
          <div className="flex h-5 w-16 rounded-md overflow-hidden border border-border/40 shrink-0">
            <div style={{ backgroundColor: pal.colors.primary }} className="flex-1" />
            <div style={{ backgroundColor: pal.colors.accent }} className="flex-1" />
            <div style={{ backgroundColor: pal.colors.secondary }} className="flex-1" />
            <div style={{ backgroundColor: pal.colors.background_tint }} className="flex-1" />
          </div>
          <span className="text-sm truncate">{pal.label}</span>
          {paletteId === pal.id && (
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 ml-auto" />
          )}
        </div>
      ),
      renderSelected: () => (
        <div className="flex items-center gap-2">
          <div className="flex h-4 w-12 rounded-sm overflow-hidden border border-border/40 shrink-0">
            <div style={{ backgroundColor: pal.colors.primary }} className="flex-1" />
            <div style={{ backgroundColor: pal.colors.accent }} className="flex-1" />
            <div style={{ backgroundColor: pal.colors.secondary }} className="flex-1" />
          </div>
          <span className="text-foreground font-medium text-sm truncate">{pal.label}</span>
        </div>
      ),
    }));
  }, [palettes, paletteId, initialPalId]);

  const effectComboboxOptions: ComboboxOption[] = Object.values(EFFECT_METADATA)
    .filter((meta) => meta.category !== "audio")
    .map((meta) => ({
      id: meta.type,
      label: meta.label.split(" (")[0],
      description: meta.description,
      searchTexts: [meta.label, meta.description, meta.category, meta.type],
      icon: meta.icon,
    }));

  const audioComboboxOptions: ComboboxOption[] = [
    {
      id: "__none__",
      label: "Không có nhạc nền",
      searchTexts: ["không", "none", "tắt"],
      icon: VolumeX,
    },
    ...AUDIO_EFFECT_PRESETS.map((preset) => ({
      id: preset.src,
      label: preset.label,
      searchTexts: [preset.label, preset.src],
      icon: Music,
    })),
    {
      id: "__custom__",
      label: "Nhập URL thủ công...",
      searchTexts: ["custom", "url", "thủ công", "nhập"],
      icon: Music,
    },
  ];

  const audioComboboxValue = !ambientAudioSrc
    ? "__none__"
    : AUDIO_EFFECT_PRESETS.some((p) => p.src === ambientAudioSrc)
      ? ambientAudioSrc
      : "__custom__";

  const [showCustomAudioInput, setShowCustomAudioInput] = useState(
    ambientAudioSrc !== "" && !AUDIO_EFFECT_PRESETS.some((p) => p.src === ambientAudioSrc)
  );

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/80 bg-secondary/30">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-editor flex items-center gap-2">
                  {initialScene ? "Chỉnh Sửa Scene (Bối Cảnh)" : "Gán Scene Cho Dải Block"}
                </h2>
                <p className="text-xs text-muted-foreground font-editor mt-0.5">
                  Áp dụng cho: <span className="font-semibold text-primary">{rangeLabel}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                stopAudioPreview();
                onClose();
              }}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex border-b border-border/60 px-6 bg-secondary/15">
            <button
              type="button"
              onClick={() => setMode("preset")}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 cursor-pointer transition-colors min-h-[44px] ${mode === "preset"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
            >
              <Sparkles className="w-4 h-4" />
              Scene Preset Có Sẵn ({presets.length})
            </button>

            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 cursor-pointer transition-colors min-h-[44px] ${mode === "custom"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
            >
              <Sliders className="w-4 h-4" />
              Tùy Chỉnh Phối Riêng
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {loading ? (
              <div className="py-20 text-center text-muted-foreground">
                <div className="inline-block w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm">Đang nạp thư viện Scene...</p>
              </div>
            ) : mode === "preset" ? (
              /* ============================================================
                 TAB 1: PRESET GRID (US-2.7)
                 ============================================================ */
              <div className="space-y-4">
                {/* Collapsible search trigger bar */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider font-ui">
                    Danh sách presets ({filteredPresets.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPresetSearchOpen((open) => !open);
                      if (presetSearchOpen) {
                        setPresetSearch("");
                        setPresetVisibleCount(INITIAL_PRESET_LIMIT);
                      }
                    }}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${presetSearchOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    aria-label={presetSearchOpen ? "Đóng tìm kiếm preset" : "Tìm kiếm preset"}
                    title={presetSearchOpen ? "Đóng tìm kiếm" : "Tìm kiếm preset"}
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>

                {/* Collapsible Search Input */}
                {presetSearchOpen && (
                  <SearchInput
                    value={presetSearch}
                    onChange={(v) => {
                      setPresetSearch(v);
                      setPresetVisibleCount(INITIAL_PRESET_LIMIT);
                    }}
                    placeholder="Tìm scene preset theo tên, mood tags..."
                    autoFocus={true}
                  />
                )}

                {/* Preset Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visiblePresets.map((preset) => {
                    const bg = backgrounds.find((b) => b.id === preset.background_id);
                    const pal = palettes.find((p) => p.id === preset.palette_id);
                    const isSelected =
                      selectedPresetId === preset.id && backgroundId === preset.background_id;
                    const { audioSrc, effects: presetEffects } = extractEffectsState(preset.effects);
                    const isPlayingThisAudio =
                      Boolean(audioSrc) && playingAudioSrc === audioSrc;

                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset)}
                        className={`relative rounded-2xl border p-4.5 cursor-pointer transition-all duration-200 flex flex-col justify-between overflow-hidden group ${isSelected
                          ? "bg-primary/10 border-primary ring-2 ring-primary/40 shadow-lg"
                          : "bg-secondary/20 border-border hover:border-primary/50 hover:bg-secondary/40"
                          }`}
                      >
                        {/* Background Visual Strip */}
                        <div className="relative h-28 w-full rounded-xl overflow-hidden mb-3 border border-border/40">
                          {bg?.type === "gradient" && (
                            <div
                              className="w-full h-full"
                              style={{ background: bg.value }}
                            />
                          )}
                          {bg?.type === "image" && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={bg.value}
                              alt={bg.label}
                              className="w-full h-full object-cover"
                            />
                          )}
                          {bg?.type === "video" && (
                            <div className="w-full h-full relative">
                              {bg.poster_frame ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={bg.poster_frame}
                                  alt={bg.label}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-linear-to-b from-slate-900 to-slate-800" />
                              )}
                              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-[10px] text-white flex items-center gap-1 font-mono">
                                <Film className="w-3 h-3 text-cyan-400" /> Video loop
                              </span>
                            </div>
                          )}
                          {bg?.type === "particle_composition" && (
                            <div className="w-full h-full bg-[#03150d] relative flex items-center justify-center">
                              <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Đom đóm / Lân tinh
                              </span>
                            </div>
                          )}

                          {/* Selected Checkmark overlay */}
                          {isSelected && (
                            <div className="absolute top-2 left-2 p-1 rounded-full bg-primary text-primary-foreground shadow-md">
                              <Check className="w-4 h-4" />
                            </div>
                          )}

                          {/* Quick Live Preview Button inside card */}
                          <button
                            type="button"
                            onClick={(e) => handleQuickPreviewPreset(e, preset)}
                            className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/75 hover:bg-primary hover:text-primary-foreground text-white/90 backdrop-blur-md text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer min-h-[30px]"
                            title="Xem trước bối cảnh này với văn bản thật"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem trước</span>
                          </button>
                        </div>

                        {/* Header + Mood Tags */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <h3 className="font-bold font-editor text-base text-foreground group-hover:text-primary transition-colors">
                              {preset.label}
                            </h3>
                          </div>

                          <div className="flex flex-wrap gap-1 mb-3">
                            {preset.mood_tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-md bg-secondary/80 text-muted-foreground text-[11px]"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Details Strip */}
                        <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            {/* Palette Swatch dots */}
                            {pal && (
                              <div
                                className="flex items-center gap-1.5 p-1 rounded-lg bg-secondary/40"
                                title={`Bảng màu: ${pal.label}`}
                              >
                                <Palette className="w-3.5 h-3.5 text-muted-foreground mr-0.5" />
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs"
                                  style={{ backgroundColor: pal.colors.primary }}
                                />
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs"
                                  style={{ backgroundColor: pal.colors.accent }}
                                />
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs"
                                  style={{ backgroundColor: pal.colors.secondary }}
                                />
                              </div>
                            )}

                            {/* Ambient particle badges */}
                            {presetEffects.length > 0 && (
                              <div
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/40 text-muted-foreground text-[11px]"
                                title={`Hiệu ứng: ${presetEffects.map((t) => EFFECT_METADATA[t.type]?.label || t.type).join(", ")}`}
                              >
                                <Sparkles className="w-3 h-3 text-accent" />
                                <span className="font-mono">{presetEffects.length} hiệu ứng</span>
                              </div>
                            )}
                          </div>

                          {/* Ambient Audio Audition */}
                          {audioSrc ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAudioPreview(audioSrc);
                              }}
                              className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer min-h-[32px] ${isPlayingThisAudio
                                ? "bg-primary text-primary-foreground border-primary animate-pulse"
                                : "bg-secondary/60 text-foreground border-border/60 hover:border-primary"
                                }`}
                              title="Nghe thử nhạc nền"
                              aria-label="Nghe thử nhạc nền"
                            >
                              {isPlayingThisAudio ? (
                                <Square className="w-3 h-3 fill-current" />
                              ) : (
                                <Play className="w-3 h-3 fill-current" />
                              )}
                              <span className="text-[10px] font-mono">Nhạc</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/60 italic">
                              Không nhạc
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* "Xem thêm" button */}
                {hasMorePresets && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setPresetVisibleCount((c) => c + INITIAL_PRESET_LIMIT)}
                      className="px-5 py-2.5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary/70 text-sm font-ui font-medium text-foreground transition-colors cursor-pointer min-h-[44px] flex items-center gap-2"
                    >
                      <ChevronDown className="w-4 h-4" />
                      Xem thêm ({filteredPresets.length - presetVisibleCount} preset còn lại)
                    </button>
                  </div>
                )}

                {/* No results */}
                {filteredPresets.length === 0 && presetSearch && (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    Không tìm thấy preset nào khớp với &ldquo;{presetSearch}&rdquo;
                  </div>
                )}
              </div>
            ) : (
              /* ============================================================
                 TAB 2: CUSTOM COMPOSITION (US-2.8)
                 ============================================================ */
              <div className="space-y-6">
                {/* 1. Chọn Background — Khung mở rộng + Search có thể đóng/mở + Limit Load-more */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-bold text-foreground flex items-center gap-2 font-ui">
                      1. Chọn Bối Cảnh Nền ({backgrounds.length})
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setBgSearchOpen((open) => !open);
                        if (bgSearchOpen) {
                          setBgSearch("");
                          setBgVisibleCount(INITIAL_BACKGROUND_LIMIT);
                        }
                      }}
                      className={`p-2 rounded-xl border transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${bgSearchOpen
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      aria-label={bgSearchOpen ? "Đóng tìm kiếm bối cảnh" : "Tìm kiếm bối cảnh"}
                      title={bgSearchOpen ? "Đóng tìm kiếm" : "Tìm kiếm bối cảnh"}
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Collapsible Search input */}
                  {bgSearchOpen && (
                    <SearchInput
                      value={bgSearch}
                      onChange={(v) => {
                        setBgSearch(v);
                        setBgVisibleCount(INITIAL_BACKGROUND_LIMIT);
                      }}
                      placeholder="Tìm bối cảnh theo tên, loại..."
                      className="mb-3"
                      autoFocus={true}
                    />
                  )}

                  {/* Expanded scrollable background grid container (max-h-[320px]) */}
                  <div className="max-h-[320px] overflow-y-auto custom-scrollbar rounded-2xl border border-border/60 bg-secondary/15 p-3.5">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                      {visibleBackgrounds.map((bg) => {
                        const isSelected = backgroundId === bg.id;
                        return (
                          <div
                            key={bg.id}
                            onClick={() => {
                              setBackgroundId(bg.id);
                              setSelectedPresetId(null);
                            }}
                            className={`rounded-xl border p-3 cursor-pointer transition-all ${isSelected
                              ? "bg-primary/15 border-primary ring-2 ring-primary/30"
                              : "bg-card border-border hover:border-primary/40 hover:bg-secondary/40"
                              }`}
                          >
                            <div className="h-20 rounded-lg overflow-hidden mb-2 relative border border-border/40">
                              {bg.type === "gradient" && (
                                <div className="w-full h-full" style={{ background: bg.value }} />
                              )}
                              {bg.type === "image" && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={bg.value} alt={bg.label} className="w-full h-full object-cover" />
                              )}
                              {bg.type === "video" && (
                                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-xs text-cyan-400">
                                  <Film className="w-4 h-4 mr-1" /> Video Loop
                                </div>
                              )}
                              {bg.type === "particle_composition" && (
                                <div className="w-full h-full bg-emerald-950 flex items-center justify-center text-xs text-emerald-400">
                                  <Sparkles className="w-4 h-4 mr-1" /> Particle
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 p-1 rounded-full bg-primary text-primary-foreground shadow-sm">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              )}
                            </div>
                            <div className="text-xs font-semibold text-foreground line-clamp-1">{bg.label}</div>
                            <div className="text-[10px] text-muted-foreground uppercase font-mono mt-0.5">{bg.type} • {bg.motion}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Background "Xem thêm" button */}
                    {hasMoreBackgrounds && (
                      <div className="flex justify-center pt-3 pb-1">
                        <button
                          type="button"
                          onClick={() => setBgVisibleCount((c) => c + INITIAL_BACKGROUND_LIMIT)}
                          className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-ui font-medium text-foreground transition-colors cursor-pointer min-h-[38px] flex items-center gap-1.5"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                          Xem thêm ({filteredBackgrounds.length - bgVisibleCount} bối cảnh còn lại)
                        </button>
                      </div>
                    )}

                    {filteredBackgrounds.length === 0 && bgSearch && (
                      <div className="py-10 text-center text-muted-foreground text-sm font-ui">
                        Không tìm thấy bối cảnh nào khớp với &ldquo;{bgSearch}&rdquo;
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Bảng Màu & Âm Thanh Nền (Grid 2 Cột) */}
                <div className="p-5 rounded-2xl bg-secondary/30 border border-border/60 space-y-4">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2 font-ui">
                    2. Phối Màu & Âm Thanh Nền
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Dropdown 1: Bảng Màu */}
                    <SearchableCombobox
                      label="Bảng Màu"
                      icon={Palette}
                      options={paletteComboboxOptions}
                      value={paletteId}
                      onSelect={(id) => {
                        setPaletteId(id);
                        setSelectedPresetId(null);
                      }}
                      placeholder="Chọn bảng màu..."
                      searchPlaceholder="Tìm bảng màu..."
                    />

                    {/* Dropdown 2: Âm Thanh Nền */}
                    <div className="space-y-3">
                      <SearchableCombobox
                        label="Âm Thanh Nền"
                        icon={Music}
                        options={audioComboboxOptions}
                        value={audioComboboxValue}
                        onSelect={(id) => {
                          if (id === "__none__") {
                            setAmbientAudioSrc("");
                            setShowCustomAudioInput(false);
                          } else if (id === "__custom__") {
                            setShowCustomAudioInput(true);
                            setAmbientAudioSrc("");
                          } else {
                            setAmbientAudioSrc(id);
                            setShowCustomAudioInput(false);
                          }
                          setSelectedPresetId(null);
                        }}
                        placeholder="Chọn nhạc nền..."
                        searchPlaceholder="Tìm âm thanh..."
                      />

                      {/* Custom audio URL input */}
                      {showCustomAudioInput && (
                        <div>
                          <input
                            type="text"
                            value={ambientAudioSrc}
                            onChange={(e) => {
                              setAmbientAudioSrc(e.target.value);
                              setSelectedPresetId(null);
                            }}
                            placeholder="/audio/my_ambient_music.mp3"
                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground font-ui focus-visible:outline-2 focus-visible:outline-ring min-h-[44px]"
                          />
                        </div>
                      )}

                      {/* Volume Slider & Loop Checkbox (only shown when audio is selected) */}
                      {ambientAudioSrc && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 min-w-0">
                          {/* Col 1: Volume Slider */}
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background border border-border min-h-[42px] min-w-0">
                            <Volume2 className="w-4 h-4 text-primary shrink-0" />
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={ambientVolume}
                              onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                              className="flex-1 w-full min-w-0 accent-primary cursor-pointer h-1.5 bg-secondary rounded-lg"
                            />
                            <span className="text-xs font-mono font-bold text-foreground shrink-0 text-right min-w-[32px]">
                              {Math.round(ambientVolume * 100)}%
                            </span>
                          </div>

                          {/* Col 2: Audio Loop Checkbox */}
                          <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-background border border-border text-xs font-medium cursor-pointer hover:bg-secondary/40 transition-colors min-h-[42px] min-w-0">
                            <span className="text-foreground truncate select-none">Lặp lại âm thanh</span>
                            <input
                              type="checkbox"
                              checked={isLoop}
                              onChange={(e) => {
                                setIsLoop(e.target.checked);
                                setSelectedPresetId(null);
                              }}
                              className="w-4 h-4 rounded border-border accent-primary cursor-pointer shrink-0"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Hiệu Ứng Không Gian (Scene Effects) — Dropdown + Badges giống BlockEditor */}
                <div ref={section3Ref} className="relative p-5 rounded-2xl bg-secondary/30 border border-border/60 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-bold text-foreground flex items-center gap-2 font-ui">
                      3. Hiệu Ứng Không Gian ({configuredEffects.length})
                    </label>

                    {/* Clear All Action in header when effects exist */}
                    {configuredEffects.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllEffects}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:text-red-600 hover:bg-destructive/10 text-destructive text-xs font-semibold transition-colors cursor-pointer min-h-[36px]"
                        title="Xóa tất cả hiệu ứng không gian đã chọn"
                        aria-label="Xóa tất cả hiệu ứng"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa tất cả</span>
                      </button>
                    )}
                  </div>

                  {/* Effects Controls Bar: Dropdown + Badges Container */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    {/* Add Effect Dropdown */}
                    <div className="w-48 md:w-56 shrink-0">
                      <SearchableCombobox
                        options={effectComboboxOptions}
                        value=""
                        onSelect={handleAddEffect}
                        placeholder="+ Thêm hiệu ứng..."
                        searchPlaceholder="Tìm hiệu ứng..."
                      />
                    </div>

                    {/* Selected Effects Badges (Style BlockEditor) */}
                    {configuredEffects.map((eff) => {
                      const Icon = getEffectIcon(eff.type, eff.category);
                      const meta = EFFECT_METADATA[eff.type];
                      const effectLabel = meta?.label?.split("(")[0].trim() || eff.type;
                      const isEditing = editingEffectId === eff.id;

                      return (
                        <div
                          key={eff.id}
                          ref={(el) => {
                            badgeRefs.current[eff.id] = el;
                          }}
                          className="relative"
                        >
                          {/* Badge Button */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setEditingEffectId(isEditing ? null : eff.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setEditingEffectId(isEditing ? null : eff.id);
                              }
                            }}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all border min-h-[42px] ${isEditing
                              ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30 shadow-md"
                              : "bg-primary/10 hover:bg-primary/20 text-foreground border-primary/30 hover:border-primary/50"
                              }`}
                            title="Click để điều chỉnh thông số chi tiết (Intensity, Duration, Delay, Loop)"
                          >
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${isEditing ? "text-primary-foreground" : "text-primary"}`} />
                            <span className="font-semibold">{effectLabel}</span>

                            {/* Delete single button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveEffect(eff.id);
                              }}
                              className={`p-1 rounded-lg hover:text-red-600 transition-colors cursor-pointer ml-1 ${isEditing
                                ? "hover:bg-primary-foreground/20 text-primary-foreground"
                                : "hover:text-destructive hover:bg-destructive/15 text-muted-foreground"
                                }`}
                              title={`Xóa hiệu ứng ${effectLabel}`}
                              aria-label={`Xóa hiệu ứng ${effectLabel}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dynamically Positioned Clamped Popover Panel */}
                  {(() => {
                    const activeEditingEffect = configuredEffects.find((e) => e.id === editingEffectId);
                    if (!activeEditingEffect || !popoverPos) return null;

                    const Icon = getEffectIcon(activeEditingEffect.type, activeEditingEffect.category);
                    const meta = EFFECT_METADATA[activeEditingEffect.type];
                    const effectLabel = meta?.label?.split("(")[0].trim() || activeEditingEffect.type;

                    return (
                      <div
                        ref={popoverRef}
                        style={{
                          top: `${popoverPos.top}px`,
                          left: `${popoverPos.left}px`,
                          width: `${popoverPos.width}px`,
                        }}
                        className="absolute z-[60] max-h-[75vh] overflow-y-auto custom-scrollbar p-4 rounded-2xl bg-card border border-border shadow-2xl space-y-3.5 text-foreground animate-fade-in font-editor"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Popover Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-primary" />
                            <span className="font-bold text-xs font-editor">{effectLabel}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCommitEffectEdit(activeEditingEffect.id)}
                            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                            aria-label="Đóng bảng chỉnh sửa"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Intensity Slider */}
                        <div>
                          <div className="flex items-center justify-between text-xs font-semibold mb-1">
                            <span className="text-muted-foreground">Độ mạnh (Intensity):</span>
                            <span className="font-mono text-primary font-bold">
                              {Math.round((activeEditingEffect.intensity ?? 0.75) * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.05"
                            value={activeEditingEffect.intensity ?? 0.75}
                            onChange={(e) =>
                              handleUpdateEffectParam(activeEditingEffect.id, "intensity", parseFloat(e.target.value))
                            }
                            className="w-full accent-primary cursor-pointer h-1.5 bg-secondary rounded-lg"
                          />
                        </div>

                        {/* Duration Slider */}
                        <div>
                          <div className="flex items-center justify-between text-xs font-semibold mb-1">
                            <span className="text-muted-foreground">Thời lượng (Duration):</span>
                            <span className="font-mono text-foreground">
                              {activeEditingEffect.duration_ms && activeEditingEffect.duration_ms > 0
                                ? `${(activeEditingEffect.duration_ms / 1000).toFixed(1)}s`
                                : "Liên tục"}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="8000"
                            step="500"
                            value={activeEditingEffect.duration_ms ?? 0}
                            onChange={(e) =>
                              handleUpdateEffectParam(activeEditingEffect.id, "duration_ms", parseInt(e.target.value, 10))
                            }
                            className="w-full accent-primary cursor-pointer h-1.5 bg-secondary rounded-lg"
                          />
                        </div>

                        {/* Delay Slider */}
                        <div>
                          <div className="flex items-center justify-between text-xs font-semibold mb-1">
                            <span className="text-muted-foreground">Độ trễ (Delay):</span>
                            <span className="font-mono text-foreground">{activeEditingEffect.delay_ms || 0}ms</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="3000"
                            step="100"
                            value={activeEditingEffect.delay_ms || 0}
                            onChange={(e) =>
                              handleUpdateEffectParam(activeEditingEffect.id, "delay_ms", parseInt(e.target.value, 10))
                            }
                            className="w-full accent-primary cursor-pointer h-1.5 bg-secondary rounded-lg"
                          />
                        </div>

                        {/* Loop Toggle */}
                        <label className="flex items-center justify-between p-2 rounded-xl bg-secondary/40 border border-border/60 text-xs font-medium cursor-pointer hover:bg-secondary/70 transition-colors">
                          <span>Lặp lại liên tục (Loop)</span>
                          <input
                            type="checkbox"
                            checked={activeEditingEffect.loop ?? true}
                            onChange={(e) => handleUpdateEffectParam(activeEditingEffect.id, "loop", e.target.checked)}
                            className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                          />
                        </label>

                        {/* Popover Actions */}
                        <div className="flex items-center justify-end pt-2 border-t border-border/60">
                          <button
                            type="button"
                            onClick={() => handleCommitEffectEdit(activeEditingEffect.id)}
                            className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-editor-action-foreground text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                          >
                            Xong
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/80 bg-secondary/30">
            <div className="text-xs text-muted-foreground hidden sm:block font-ui">
              {mode === "preset"
                ? "Giá trị preset sẽ được sao chép độc lập vào Scene của bạn."
                : "Bối cảnh tùy chỉnh được lưu riêng cho chương này."}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleOpenPreview}
                disabled={isSaveDisabled}
                className="px-4 py-2 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-sm transition-all cursor-pointer min-h-[42px] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  isSaveDisabled
                    ? mode === "preset"
                      ? "Vui lòng chọn 1 Scene Preset để xem trước"
                      : "Vui lòng chọn bối cảnh và bảng màu để xem trước"
                    : "Xem trước bối cảnh với văn bản thực tế"
                }
              >
                <Eye className="w-4 h-4" />
                <span>Xem Trước</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaveDisabled}
                className="px-5 py-2 rounded-xl bg-editor-action hover:bg-editor-action-hover text-editor-action-foreground font-semibold text-sm shadow-md transition-all cursor-pointer min-h-[42px] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  isSaveDisabled
                    ? mode === "preset"
                      ? "Vui lòng chọn 1 Scene Preset để áp dụng"
                      : "Vui lòng chọn Bối Cảnh Nền và Bảng Màu"
                    : "Áp dụng Scene cho dải block"
                }
              >
                <Check className="w-4 h-4" />
                <span>Áp Dụng Scene</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =======================================================================
          FULL INTERACTIVE LIVE PREVIEW MODAL OVERLAY (US-2.7, US-2.8, US-2.9)
          ======================================================================= */}
      {isPreviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[90] bg-background text-foreground overflow-y-auto animate-fade-in flex flex-col"
        >
          {/* 1. Background Layer */}
          {activeBackgroundAsset && (
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
              <SceneBackground asset={activeBackgroundAsset} reducedMotion={false} />
            </div>
          )}

          {/* 2. Color Palette Cinematic Color Grading & Ambient Atmosphere */}
          {activeColorPalette && (
            <>
              {/* 2a. Color Wash (Nhuộm sắc độ vào Background bằng mix-blend-mode) */}
              <div
                className="fixed inset-0 pointer-events-none z-0 transition-all duration-700 ease-in-out"
                style={{
                  backgroundColor: activeColorPalette.colors.primary,
                  mixBlendMode: "color",
                  opacity: 0.5,
                }}
                aria-hidden="true"
              />

              {/* 2b. Atmospheric Gradient & Depth Tint: Tạo chiều sâu khí quyển và tăng tương phản chữ */}
              <div
                className="fixed inset-0 pointer-events-none z-0 transition-all duration-700 ease-in-out"
                style={{
                  background: `radial-gradient(circle at 50% 35%, transparent 15%, ${activeColorPalette.colors.background_tint} 85%)`,
                  opacity: 0.88,
                }}
                aria-hidden="true"
              />

              {/* 2c. Ambient Lighting Aura: Ánh sáng môi trường viền trên/dưới theo màu primary & secondary */}
              <div
                className="fixed inset-0 pointer-events-none z-0 transition-all duration-700 ease-in-out"
                style={{
                  background: `linear-gradient(to bottom, ${activeColorPalette.colors.primary}33 0%, transparent 25%, transparent 75%, ${activeColorPalette.colors.secondary}66 100%)`,
                }}
                aria-hidden="true"
              />
            </>
          )}

          {/* 3. Ambient Visual/Motion/Transition Effects in Live Preview */}
          {configuredEffects.map((eff, idx) => {
            const effKey = eff.id || `${eff.type}-${idx}`;
            const isEffectActive = !!previewActiveEffects[effKey];
            if (!isEffectActive) return null;

            const Comp = EFFECT_REGISTRY[eff.type];
            if (!Comp) return null;
            return (
              <div key={effKey} className="fixed inset-0 pointer-events-none z-[5] overflow-hidden">
                <Comp
                  config={eff}
                  isActive={isEffectActive}
                  intensityMultiplier={1}
                />
              </div>
            );
          })}

          {/* 4. Ambient Audio */}
          {ambientAudioSrc && (
            <SceneAmbientAudio
              audioSrc={ambientAudioSrc}
              volume={ambientVolume}
              isActive={true}
              isPaused={isPreviewMuted}
              loop={isLoop}
            />
          )}

          {/* 5. Top Floating Navigation Bar */}
          <header className="sticky top-0 z-30 w-full px-4 md:px-8 py-3 bg-card/85 backdrop-blur-xl border-b border-border text-card-foreground font-editor flex items-center justify-between shadow-xl transition-colors">
            {/* Left: Back button & Scene metadata */}
            <div className="flex items-center gap-3 md:gap-4">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer min-h-[44px] shadow-xs"
                title="Quay lại bảng chọn Scene"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Quay lại chỉnh sửa</span>
              </button>

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 text-[10px] font-bold font-mono tracking-wider">
                    PREVIEW
                  </span>
                  <h3 className="text-sm md:text-base font-bold font-editor text-foreground line-clamp-1">
                    {previewSceneLabel}
                  </h3>
                </div>

                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{rangeLabel}</span>
                  {activeColorPalette && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/60 border border-border text-[11px] text-foreground">
                        <Palette className="w-3 h-3 text-accent" />
                        <span className="font-medium">{activeColorPalette.label}</span>
                        <div className="flex items-center gap-1 ml-0.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-white/30 shadow-xs"
                            style={{ backgroundColor: activeColorPalette.colors.primary }}
                            title="Primary"
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-white/30 shadow-xs"
                            style={{ backgroundColor: activeColorPalette.colors.accent }}
                            title="Accent"
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-white/30 shadow-xs"
                            style={{ backgroundColor: activeColorPalette.colors.secondary }}
                            title="Secondary"
                          />
                        </div>
                      </div>
                    </>
                  )}
                  {configuredEffects.length > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-[11px] text-accent font-mono">
                        {configuredEffects.length} hiệu ứng không gian
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Audio Volume Control & Primary Save Action */}
            <div className="flex items-center gap-2.5 md:gap-3">
              {/* Audio Volume & Mute control */}
              {ambientAudioSrc && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/60 border border-border min-h-[44px]">
                  <button
                    type="button"
                    onClick={() => setIsPreviewMuted(!isPreviewMuted)}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title={isPreviewMuted ? "Bật âm thanh" : "Tắt tiếng"}
                    aria-label={isPreviewMuted ? "Bật âm thanh" : "Tắt tiếng"}
                  >
                    {isPreviewMuted ? (
                      <VolumeX className="w-4 h-4 text-destructive" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-primary" />
                    )}
                  </button>

                  <div className="hidden md:flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      disabled={isPreviewMuted}
                      value={isPreviewMuted ? 0 : ambientVolume}
                      onChange={(e) => {
                        setAmbientVolume(parseFloat(e.target.value));
                        if (isPreviewMuted) setIsPreviewMuted(false);
                      }}
                      className="w-16 accent-primary cursor-pointer h-1.5 bg-background rounded-lg disabled:opacity-40"
                      title="Âm lượng nhạc nền"
                    />
                    <span className="text-[11px] font-mono w-8 text-right">
                      {isPreviewMuted ? "0%" : `${Math.round(ambientVolume * 100)}%`}
                    </span>
                  </div>
                </div>
              )}

              {/* Primary Apply Button */}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaveDisabled}
                className="px-5 py-2.5 rounded-xl bg-editor-action hover:bg-editor-action-hover text-editor-action-foreground font-semibold text-xs md:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer min-h-[44px] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  isSaveDisabled
                    ? mode === "preset"
                      ? "Vui lòng chọn 1 Scene Preset để áp dụng"
                      : "Vui lòng chọn Bối Cảnh Nền và Bảng Màu"
                    : "Áp dụng Scene cho dải block"
                }
              >
                <Check className="w-4 h-4" />
                <span>Áp Dụng Scene</span>
              </button>
            </div>
          </header>

          {/* 6. Main Preview Content with Reader Typography */}
          <main
            className="relative z-20 flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-12"
            style={
              activeColorPalette
                ? ({
                  "--color-primary": activeColorPalette.colors.primary,
                  "--color-secondary": activeColorPalette.colors.secondary,
                  "--color-accent": activeColorPalette.colors.accent,
                } as React.CSSProperties)
                : {}
            }
          >
            {/* Story text blocks rendering */}
            <div className="prose-reader font-size-lg space-y-6">
              {selectedBlocks.map((block) => {
                const isFirstP = block.id === firstParagraphId;

                return (
                  <div key={block.id} className="story-block relative z-20 my-8">
                    {block.type === "heading" && (
                      <div className="my-10 text-center">
                        <h2 className="font-display text-2xl md:text-3xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#F8FAFC] via-[var(--color-primary,#38BDF8)] to-[#F8FAFC] inline-block pb-3 border-b-2 border-[var(--color-accent,#E2B714)]/60">
                          {block.text}
                        </h2>
                      </div>
                    )}

                    {block.type === "paragraph" && (
                      <p
                        className={`font-story story-font-cormorant text-lg md:text-xl leading-relaxed text-[#F8FAFC] transition-all duration-300 ${isFirstP ? "drop-cap" : ""
                          }`}
                      >
                        {block.text}
                      </p>
                    )}

                    {block.type === "dialogue" && (
                      <div className="dialogue-box my-6 p-5 md:p-6 rounded-r-2xl border-l-4 border-[var(--color-accent,#E2B714)] shadow-xl transition-all duration-500">
                        <p className="font-story story-font-cormorant text-lg md:text-xl leading-relaxed text-[#F8FAFC]">
                          {block.text}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      )}
    </>
  );
}
