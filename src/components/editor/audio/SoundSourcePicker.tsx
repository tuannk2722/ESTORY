"use client";

import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { Library, Upload } from "lucide-react";
import type { AudioAsset } from "@/types/audio-asset";
import { audioAssetSchema } from "@/lib/validation/audio-asset-schema";
import { useAudioPreview } from "../effects/useAudioPreview";
import { audioError, audioRequest, claimAudio, uploadPersonalAudio, validateAudioFile } from "./audioTransport";
import FreesoundSearchPanel from "./FreesoundSearchPanel";
import SoundRow, { audioFocusRing } from "./SoundRow";

const button = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors motion-reduce:transition-none disabled:opacity-50 ${audioFocusRing}`;
export default function SoundSourcePicker({ selectedId, onSelect, audioPreview }: { selectedId?: string; onSelect(asset: AudioAsset): void; audioPreview?: ReturnType<typeof useAudioPreview> }) {
  const [tab, setTab] = useState(0);
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState<{ file: File; id: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const localPreview = useAudioPreview();
  const preview = audioPreview ?? localPreview;
  const id = useId();

  useEffect(() => {
    const abort = new AbortController();
    audioRequest("/api/audio-assets", z.array(audioAssetSchema), undefined, abort.signal)
      .then((loaded) => setAssets((current) => [...current, ...loaded.filter((asset) => !current.some((item) => item.id === asset.id))]))
      .catch((e) => { if (!abort.signal.aborted) setError(audioError(e)); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => { abort.abort(); controller.current?.abort(); };
  }, []);

  const select = (asset: AudioAsset) => { preview.stopAudio(); onSelect(asset); };
  const added = (asset: AudioAsset) => {
    setAssets((items) => [asset, ...items.filter((item) => item.id !== asset.id)]);
    setTab(0);
    setNotice(`Đã thêm “${asset.title}” vào thư viện.`);
    requestAnimationFrame(() => { if (list.current) list.current.scrollTop = 0; });
  };
  const upload = async (chosen: File) => {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setFile(chosen); setBusy(true); setError(""); setNotice(""); setProgress(0); preview.stopAudio();
    try {
      await validateAudioFile(chosen);
      if (abort.signal.aborted) return;
      const uploadId = completed?.file === chosen ? completed.id : await uploadPersonalAudio(chosen, abort.signal, setProgress);
      setCompleted({ file: chosen, id: uploadId });
      if (abort.signal.aborted) return;
      added(await claimAudio(uploadId, chosen.name.slice(0, 200)));
      setFile(null); setCompleted(null);
    } catch (e) {
      setError(abort.signal.aborted ? "Đã hủy tải lên." : audioError(e));
    } finally { setBusy(false); controller.current = null; }
  };
  const changeTab = (next: number) => { preview.stopAudio(); setTab(next); };

  return (
    <section className="min-w-0 space-y-3 text-foreground" aria-label="Âm thanh cá nhân">
      <div role="tablist" aria-label="Nguồn âm thanh" className="flex gap-4 border-b border-border">
        {[`Thư viện của tôi (${assets.length})`, "Tìm trên Freesound"].map((label, index) => (
          <button key={label} type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={tab === index}
            tabIndex={tab === index ? 0 : -1} disabled={busy || importBusy}
            className={`min-h-11 border-b-2 px-1 py-2 text-xs font-semibold ${audioFocusRing} ${tab === index ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => changeTab(index)}
            onKeyDown={(event) => {
              const next = event.key === "ArrowRight" || event.key === "ArrowLeft" ? 1 - index : event.key === "Home" ? 0 : event.key === "End" ? 1 : null;
              if (next !== null) { event.preventDefault(); changeTab(next); document.getElementById(`${id}-tab-${next}`)?.focus(); }
            }}>{label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel-${tab}`} aria-labelledby={`${id}-tab-${tab}`} tabIndex={0} className={`rounded-lg ${audioFocusRing}`}>
        {tab === 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p id={`${id}-upload-hint`} className="mt-1 text-[11px] text-muted-foreground">MP3, WAV, OGG · tối đa 8 MiB / 5 phút</p>
              <input ref={input} type="file" accept=".mp3,.wav,.ogg" className="hidden" aria-label="Chọn tệp âm thanh" disabled={busy}
                onChange={(event) => { const chosen = event.target.files?.[0]; event.target.value = ""; if (chosen) { setCompleted(null); void upload(chosen); } }} />
              <button type="button" className={`${button} bg-primary/10 text-primary hover:bg-primary/20`} disabled={busy} aria-describedby={`${id}-upload-hint`} onClick={() => input.current?.click()}><Upload className="h-4 w-4" aria-hidden="true" />Tải âm thanh</button>
            </div>
            {busy && <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="flex items-center justify-between gap-2"><p role="status" className="min-w-0 truncate text-xs">{progress === 100 ? "Đang kiểm tra và lưu…" : `Đang tải ${progress}% · ${file?.name}`}</p><button type="button" disabled={progress === 100} className={`${button} hover:bg-secondary`} onClick={() => controller.current?.abort()}>Hủy</button></div>
              <progress className="h-1.5 w-full accent-primary" value={progress} max={100} aria-label="Tiến độ tải âm thanh" />
            </div>}
            {notice && <p role="status" className="text-xs text-muted-foreground">{notice}</p>}
            <div ref={list} className="max-h-64 space-y-2 overflow-y-auto overscroll-contain p-1 custom-scrollbar">
              {loading && assets.length === 0 ? <p role="status" className="py-6 text-center text-xs text-muted-foreground">Đang tải thư viện…</p> : assets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-8 text-center"><Library className="mx-auto mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" /><p className="text-xs font-medium">Thư viện chưa có âm thanh</p><p className="mt-1 text-xs text-muted-foreground">Tải tệp lên hoặc tìm trên Freesound để bắt đầu.</p></div>
              ) : assets.map((asset) => (
                <SoundRow key={asset.id} title={asset.title} selected={selectedId === asset.id || selectedId === asset.url} playing={preview.previewingAudioSrc === asset.url}
                  onPreview={() => preview.togglePlayAudio(asset.url)} onSelect={() => select(asset)}
                  description={`${Math.round(asset.duration_ms / 1000)} giây · ${asset.source === "freesound" ? `Freesound${asset.attribution?.author_name ? ` (${asset.attribution.author_name})` : ""}` : "Tệp của bạn"}`} />
              ))}
            </div>
          </div>
        ) : <FreesoundSearchPanel audioPreview={preview} onBusyChange={setImportBusy} onImported={(asset) => { added(asset); select(asset); }} />}
      </div>
      {error && <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive"><p>{error}</p>{file && !busy && <button type="button" className={`${button} mt-1 hover:bg-destructive/10`} onClick={() => void upload(file)}>{completed ? "Thử lưu lại" : "Thử tải lại"}</button>}</div>}
    </section>
  );
}
