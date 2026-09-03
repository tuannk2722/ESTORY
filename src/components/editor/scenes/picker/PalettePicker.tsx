// src/components/editor/scenes/picker/PalettePicker.tsx
// Dropdown chọn Bảng Phối Màu — SearchableCombobox với 4 vệt màu, highlight nền riêng và dấu tích Check khi được chọn (Task 2)

"use client";

import React, { useMemo } from "react";
import { ColorPalette } from "@/types/scene";
import { Palette, Check } from "lucide-react";
import SearchableCombobox, { ComboboxOption } from "@/components/ui/SearchableCombobox";

export interface PalettePickerProps {
  palettes: ColorPalette[];
  selectedPaletteId: string;
  onSelectPalette: (id: string) => void;
  initialPaletteId?: string;
}

export const PalettePicker = React.memo(function PalettePicker({
  palettes,
  selectedPaletteId,
  onSelectPalette,
  initialPaletteId,
}: PalettePickerProps) {
  const paletteComboboxOptions: ComboboxOption[] = useMemo(() => {
    const list = [...palettes];

    // Khi edit, đưa palette ban đầu lên đầu danh sách
    if (initialPaletteId) {
      const idx = list.findIndex((p) => p.id === initialPaletteId);
      if (idx > 0) {
        const [usedItem] = list.splice(idx, 1);
        list.unshift(usedItem);
      }
    }

    return list.map((pal) => ({
      id: pal.id,
      label: pal.label,
      description: pal.mood_tags.join(", "),
      searchTexts: [pal.label, ...pal.mood_tags],
      renderOption: (isSelected: boolean) => (
        <div className="flex items-center justify-between w-full p-2 rounded-lg transition-colors text-foreground" >
          <div className="flex items-center gap-3">
            <div className="w-16 h-3.5 rounded-sm flex overflow-hidden border border-white/20 shrink-0">
              <div style={{ backgroundColor: pal.colors.primary }} className="flex-1" />
              <div style={{ backgroundColor: pal.colors.accent }} className="flex-1" />
              <div style={{ backgroundColor: pal.colors.secondary }} className="flex-1" />
              <div
                style={{ backgroundColor: pal.colors.background_tint || pal.colors.primary }}
                className="flex-1 opacity-70"
              />
            </div>
            <span className="text-xs md:text-sm truncate">
              {pal.label}
            </span>
          </div>
          {isSelected && (
            <Check className="w-4 h-4 text-primary shrink-0 stroke-[2.5]" />
          )}
        </div>
      ),
      renderSelected: () => (
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-12 h-3 rounded-sm flex overflow-hidden border border-white/20 shrink-0">
            <div style={{ backgroundColor: pal.colors.primary }} className="flex-1" />
            <div style={{ backgroundColor: pal.colors.accent }} className="flex-1" />
            <div style={{ backgroundColor: pal.colors.secondary }} className="flex-1" />
            <div
              style={{ backgroundColor: pal.colors.background_tint || pal.colors.primary }}
              className="flex-1 opacity-70"
            />
          </div>
          <span className="text-foreground font-medium text-xs md:text-sm truncate">
            {pal.label}
          </span>
        </div>
      ),
    }));
  }, [palettes, initialPaletteId]);

  return (
    <SearchableCombobox
      label="Bảng Màu Ánh Sáng & Khí Quyển"
      icon={Palette}
      options={paletteComboboxOptions}
      value={selectedPaletteId}
      onSelect={onSelectPalette}
      placeholder="Chọn bảng màu..."
      searchPlaceholder="Tìm bảng màu..."
    />
  );
});

export default PalettePicker;
