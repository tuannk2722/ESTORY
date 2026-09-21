"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, LoaderCircle, Search } from "lucide-react";
import { z } from "zod";
import type { AudioAsset } from "@/types/audio-asset";
import { audioAssetSchema } from "@/lib/validation/audio-asset-schema";
import { audioError, audioRequest } from "./audioTransport";
import { useFreesoundConnection } from "./useFreesoundConnection";
import { useAudioPreview } from "../effects/useAudioPreview";
import SoundRow, { audioFocusRing } from "./SoundRow";

const resultSchema = z.object({
  count: z.number(), hasMore: z.boolean(), results: z.array(z.object({
    id: z.number(), name: z.string(), username: z.string(), url: z.url(), license: z.url(), duration: z.number(), previews: z.object({ "preview-hq-mp3": z.url() }),
  }))
});
const button = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 ${audioFocusRing}`;
export default function FreesoundSearchPanel({ onImported, audioPreview, onBusyChange }: { onImported(asset: AudioAsset): void; audioPreview?: ReturnType<typeof useAudioPreview>; onBusyChange?(busy: boolean): void }) {
  const connection = useFreesoundConnection();
  const localPreview = useAudioPreview();
  const preview = audioPreview ?? localPreview;
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<z.infer<typeof resultSchema> | null>(null);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const importBusy = useRef(false);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!q.trim()) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      audioRequest(`/api/integrations/freesound/search?q=${encodeURIComponent(q.trim())}&page=${page}`, resultSchema, undefined, abort.signal)
        .then((data) => { if (!abort.signal.aborted) { setResults(data); if (list.current) list.current.scrollTop = 0; } })
        .catch((e) => { if (!abort.signal.aborted) setError(audioError(e)); })
        .finally(() => { if (!abort.signal.aborted) setSearching(false); });
    }, 600);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [q, page, retry]);
  const quota = connection.status?.freesound_import_quota;
  const connected = connection.status?.freesound_connection.connected;
  const importSound = async (id: number) => {
    if (importBusy.current) return;
    importBusy.current = true; setImporting(id); onBusyChange?.(true); setError(""); preview.stopAudio();
    try { onImported(await audioRequest("/api/integrations/freesound/import", audioAssetSchema, { freesound_sound_id: String(id) })); }
    catch (e) { setError(audioError(e)); await connection.refresh(); }
    finally { importBusy.current = false; setImporting(null); onBusyChange?.(false); }
  };
  const changePage = (next: number) => {
    preview.stopAudio(); setPage(next); setSearching(true); setResults(null); setError("");
  };
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="sr-only">Tìm âm thanh trên Freesound</span>
        <span className="relative block"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input type="search" maxLength={120} value={q} disabled={importing !== null}
            onChange={(e) => { preview.stopAudio(); setQ(e.target.value); setPage(1); setResults(null); setError(""); setSearching(Boolean(e.target.value.trim())); }}
            className={`block min-h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm placeholder:text-muted-foreground ${audioFocusRing}`}
            placeholder="Tìm âm thanh, ví dụ: rain, forest…" />
        </span>
      </label>
      {!connected && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/40 px-3 py-2">
        <p className="text-xs text-muted-foreground">Nghe thử tự do. Kết nối để dùng âm thanh.</p>
        <button type="button" className={`${button} text-primary hover:bg-primary/10`} disabled={connection.connecting} onClick={connection.connect}>{connection.connecting ? "Đang kết nối…" : "Kết nối Freesound"}</button>
      </div>}
      {quota && <p className="text-[11px] text-muted-foreground">Còn {Math.max(0, quota.limit - quota.used)}/{quota.limit} lượt sử dụng · Đặt lại {new Date(quota.reset_at).toLocaleString("vi-VN")}</p>}
      <div ref={list} aria-busy={searching} aria-label="Kết quả tìm âm thanh" className="max-h-72 space-y-2 overflow-y-auto overscroll-contain p-1 custom-scrollbar">
        {searching && <p role="status" className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Đang tìm âm thanh…</p>}
        {!q.trim() && <p className="py-8 text-center text-xs text-muted-foreground">Nhập từ khóa để tìm âm thanh phù hợp với câu chuyện.</p>}
        {results?.results.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">Không có kết quả. Thử từ khóa khác.</p>}
        {results?.results.map((sound) => (
          <SoundRow key={sound.id} title={sound.name} playing={preview.previewingAudioSrc === sound.previews["preview-hq-mp3"]}
            onPreview={() => preview.togglePlayAudio(sound.previews["preview-hq-mp3"])}
            description={<>{Math.round(sound.duration)} giây · {sound.username} · <a href={sound.license} target="_blank" rel="noreferrer" className={`rounded underline underline-offset-2 hover:text-foreground ${audioFocusRing}`}>Giấy phép</a></>}
            action={<button type="button" className={`${button} bg-primary/10 text-primary hover:bg-primary/20`}
              disabled={!connected || !quota || quota.used >= quota.limit || importing !== null} onClick={() => void importSound(sound.id)} aria-label={`Dùng sound này: ${sound.name}`}>
              {importing === sound.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
              {importing === sound.id ? "Đang nhập…" : "Dùng sound này"}
            </button>} />
        ))}
      </div>
      {(results || page > 1) && <nav aria-label="Phân trang kết quả âm thanh" className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <p className="text-[11px] text-muted-foreground" role="status">{results ? `${results.count.toLocaleString("vi-VN")} kết quả` : "Đang tải kết quả"}</p>
        <div className="flex items-center gap-1">
          <button type="button" className={`${button} text-muted-foreground hover:bg-secondary hover:text-foreground`} aria-label="Trang trước" disabled={page === 1 || searching || importing !== null} onClick={() => changePage(page - 1)}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
          <span className="px-2 text-xs font-medium" aria-current="page">Trang {page}</span>
          <button type="button" className={`${button} text-muted-foreground hover:bg-secondary hover:text-foreground`} aria-label="Trang tiếp" disabled={!results?.hasMore || searching || page === 100 || importing !== null} onClick={() => changePage(page + 1)}><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      </nav>}
      {(error || connection.error) && <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive"><p>{error || connection.error}</p>
        {error && !results && q.trim() && !searching && <button type="button" className={`${button} mt-1 hover:bg-destructive/10`} onClick={() => { setError(""); setSearching(true); setRetry((value) => value + 1); }}>Thử tìm lại</button>}
      </div>}
    </div>
  );
}
