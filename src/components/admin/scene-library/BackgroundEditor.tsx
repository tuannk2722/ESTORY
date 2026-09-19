"use client";

import { ChevronDown, Info, LoaderCircle, RotateCcw, Save, UploadCloud, XCircle } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";
import type { BackgroundRenderSnapshot, BackgroundType } from "@/types/scene";
import type {
  BackgroundAdminRenderInput,
  BackgroundCatalogCreate,
  ManagedBackgroundAsset,
} from "@/types/scene-catalog-admin";
import SceneCatalogMediaField from "./SceneCatalogMediaField";
import SceneCatalogPreview from "./SceneCatalogPreview";
import {
  CatalogErrorSummary,
  CatalogInlineError,
  SceneCatalogDrawerShell,
  catalogFieldErrors,
  type CatalogFieldError,
} from "./SceneCatalogFormParts";
import {
  SceneCatalogRequestError,
  SceneCatalogUploadCancelledError,
  createBackground,
  updateBackground,
  uploadGlobalBackground,
} from "./sceneCatalogTransport";

interface StopInput { color: string; position: number }

interface BackgroundFormState {
  label: string;
  moodTags: string;
  kind: BackgroundType;
  angleDeg: number;
  shape: "circle" | "ellipse";
  centerX: number;
  centerY: number;
  stops: StopInput[];
  compositionKey: "fireflies_green" | "abyss_particles";
  particleMotion: "static" | "looping";
}

const DEFAULT_STOPS: StopInput[] = [
  { color: "#172554", position: 0 },
  { color: "#020617", position: 1 },
];

function initialState(item?: ManagedBackgroundAsset): BackgroundFormState {
  const data = item?.render.render_data;
  return {
    label: item?.label ?? "",
    moodTags: item?.mood_tags.join(", ") ?? "",
    kind: data?.kind ?? "image",
    angleDeg: data?.kind === "gradient" ? data.angle_deg : 180,
    shape: data?.kind === "radial_gradient" ? data.shape : "ellipse",
    centerX: data?.kind === "radial_gradient" ? data.center.x : 0.5,
    centerY: data?.kind === "radial_gradient" ? data.center.y : 0.4,
    stops: data?.kind === "gradient" || data?.kind === "radial_gradient"
      ? data.stops.map((stop) => ({ ...stop }))
      : DEFAULT_STOPS.map((stop) => ({ ...stop })),
    compositionKey: data?.kind === "particle_composition"
      && (data.composition_key === "fireflies_green" || data.composition_key === "abyss_particles")
      ? data.composition_key
      : "fireflies_green",
    particleMotion: data?.kind === "particle_composition" ? item?.render.motion ?? "static" : "static",
  };
}

function parseMoodTags(value: string): string[] {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function useObjectUrl(file: File | null): string | null {
  const url = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => {
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [url]);
  return url;
}

function previewRender(
  form: BackgroundFormState,
  item: ManagedBackgroundAsset | undefined,
  primaryUrl: string | null,
  posterUrl: string | null,
): BackgroundRenderSnapshot | undefined {
  if (form.kind === "image") {
    if (primaryUrl) return { render_data: { kind: "image", media_url: primaryUrl }, motion: "static" };
    return item?.render.render_data.kind === "image" ? item.render : undefined;
  }
  if (form.kind === "video") {
    if (primaryUrl || posterUrl) {
      return primaryUrl && posterUrl
        ? { render_data: { kind: "video", media_url: primaryUrl }, motion: "looping", poster_frame: posterUrl }
        : undefined;
    }
    return item?.render.render_data.kind === "video" ? item.render : undefined;
  }
  if (form.kind === "gradient") {
    return { render_data: { kind: "gradient", angle_deg: form.angleDeg, stops: form.stops }, motion: "static" };
  }
  if (form.kind === "radial_gradient") {
    return {
      render_data: {
        kind: "radial_gradient",
        shape: form.shape,
        center: { x: form.centerX, y: form.centerY },
        stops: form.stops,
      },
      motion: "static",
    };
  }
  const poster = posterUrl ?? (item?.render.render_data.kind === "particle_composition" ? item.render.poster_frame : undefined);
  return {
    render_data: { kind: "particle_composition", composition_key: form.compositionKey, config: {} },
    motion: form.particleMotion,
    ...(poster ? { poster_frame: poster } : {}),
  };
}

const fieldClass = "mt-1.5 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm disabled:opacity-60";
const selectClass = "min-h-11 w-full appearance-none rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] pl-3 pr-10 text-sm disabled:opacity-60";

export default function BackgroundEditor({
  item,
  onClose,
  onSaved,
}: {
  item?: ManagedBackgroundAsset;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const initial = useMemo(() => initialState(item), [item]);
  const [form, setForm] = useState(initial);
  const [primaryFile, setPrimaryFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<CatalogFieldError[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ primary: number; poster?: number; processing: boolean } | null>(null);
  const [uploadFailed, setUploadFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const shouldFocusErrorsRef = useRef(false);
  const primaryUrl = useObjectUrl(primaryFile);
  const posterUrl = useObjectUrl(posterFile);
  const preview = useMemo(
    () => previewRender(form, item, primaryUrl, posterUrl),
    [form, item, posterUrl, primaryUrl],
  );
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || Boolean(primaryFile || posterFile);

  useEffect(() => {
    if (!shouldFocusErrorsRef.current || !errors.length) return;
    shouldFocusErrorsRef.current = false;
    summaryRef.current?.focus();
  }, [errors]);

  const focusErrors = (next: CatalogFieldError[]) => {
    shouldFocusErrorsRef.current = next.length > 0;
    setErrors(next);
  };

  const set = <K extends keyof BackgroundFormState>(key: K, value: BackgroundFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const setFileError = (id: "background-file" | "background-poster", message: string | null) => {
    setErrors((current) => [
      ...current.filter((error) => error.id !== id),
      ...(message ? [{ id, message }] : []),
    ]);
  };

  const changeKind = (kind: BackgroundType) => {
    set("kind", kind);
    setPrimaryFile(null);
    setPosterFile(null);
    setErrors((current) => current.filter((error) =>
      error.id !== "background-file" && error.id !== "background-poster"));
  };

  const validate = (): CatalogFieldError[] => {
    const next: CatalogFieldError[] = [];
    if (!form.label.trim()) next.push({ id: "catalog-label", message: "Tên hiển thị không được để trống." });
    if (form.kind === "image" && !primaryFile && item?.render.render_data.kind !== "image") {
      next.push({ id: "background-file", message: "Hãy chọn ảnh nền." });
    }
    if (form.kind === "video") {
      if (!primaryFile && item?.render.render_data.kind !== "video") next.push({ id: "background-file", message: "Hãy chọn video nền." });
      if (primaryFile && !posterFile) next.push({ id: "background-poster", message: "Video mới cần một ảnh poster." });
      if (posterFile && !primaryFile) next.push({ id: "background-file", message: "Chọn video khi thay poster." });
    }
    if (form.kind === "gradient") {
      if (form.angleDeg < 0 || form.angleDeg > 360 || !Number.isFinite(form.angleDeg)) {
        next.push({ id: "background-angle", message: "Góc phải từ 0° đến 360°." });
      }
    }
    if (form.kind === "radial_gradient") {
      if (form.centerX < 0 || form.centerX > 1 || !Number.isFinite(form.centerX) ||
          form.centerY < 0 || form.centerY > 1 || !Number.isFinite(form.centerY)) {
        next.push({ id: "background-center", message: "Tọa độ tâm phải từ 0 đến 1." });
      }
    }
    if ((form.kind === "gradient" || form.kind === "radial_gradient") && form.stops.length < 2) {
      next.push({ id: "background-stops", message: "Gradient cần ít nhất hai điểm màu." });
    }
    if (form.kind === "particle_composition" && form.particleMotion === "looping") {
      const currentPoster = item?.render.render_data.kind === "particle_composition" && item.render.poster_frame;
      if (!posterFile && !currentPoster) next.push({ id: "background-poster", message: "Chuyển động hạt cần một ảnh poster." });
    }
    return next;
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const validation = validate();
    focusErrors(validation);
    if (validation.length) return;
    setPending(true);
    setUploadFailed(false);
    setUploadProgress(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let uploadId: string | undefined;
      let particlePosterUploadId: string | undefined;
      if ((form.kind === "image" || form.kind === "video") && primaryFile) {
        uploadId = await uploadGlobalBackground(
          primaryFile,
          form.kind === "video" ? posterFile ?? undefined : undefined,
          controller.signal,
          setUploadProgress,
        );
      } else if (form.kind === "particle_composition" && posterFile) {
        particlePosterUploadId = await uploadGlobalBackground(
          posterFile,
          undefined,
          controller.signal,
          setUploadProgress,
        );
      }

      let render: BackgroundAdminRenderInput;
      if (form.kind === "image") render = { kind: "image", ...(uploadId ? { uploadId } : {}) };
      else if (form.kind === "video") render = { kind: "video", ...(uploadId ? { uploadId } : {}) };
      else if (form.kind === "gradient") render = { kind: "gradient", angleDeg: form.angleDeg, stops: form.stops };
      else if (form.kind === "radial_gradient") render = {
        kind: "radial_gradient",
        shape: form.shape,
        center: { x: form.centerX, y: form.centerY },
        stops: form.stops,
      };
      else render = {
        kind: "particle_composition",
        compositionKey: form.compositionKey,
        config: {},
        motion: form.particleMotion,
        ...(particlePosterUploadId ? { posterUploadId: particlePosterUploadId } : {}),
      };

      const write = { label: form.label.trim(), moodTags: parseMoodTags(form.moodTags), render };
      if (item) {
        await updateBackground(item.id, { ...write, expectedUpdatedAt: item.updated_at });
      } else {
        await createBackground(write as BackgroundCatalogCreate);
      }
      toast.success(item ? "Đã cập nhật bối cảnh." : "Đã tạo bối cảnh nháp.");
      await onSaved();
      onClose();
    } catch (error) {
      if (error instanceof SceneCatalogUploadCancelledError) {
        focusErrors([{ id: "background-file", message: "Đã hủy tải tệp. Bạn có thể thử lại." }]);
      } else {
        if (!(error instanceof SceneCatalogRequestError) || error.code.includes("UPLOAD") || error.status === 0) {
          setUploadFailed(true);
        }
        focusErrors(catalogFieldErrors(error, "catalog-general"));
      }
    } finally {
      abortRef.current = null;
      setPending(false);
    }
  };

  const updateStop = (index: number, patch: Partial<StopInput>) => {
    set("stops", form.stops.map((stop, stopIndex) => stopIndex === index ? { ...stop, ...patch } : stop));
  };

  return (
    <SceneCatalogDrawerShell
      title={item?.label ?? "Bối cảnh mới"}
      kicker={item ? "Chỉnh sửa Background" : "Tạo Background nháp"}
      dirty={dirty}
      pending={pending}
      onClose={onClose}
      footer={(
        <button form="background-editor-form" type="submit" disabled={pending || !dirty} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : uploadFailed ? <RotateCcw aria-hidden="true" className="h-4 w-4" /> : <Save aria-hidden="true" className="h-4 w-4" />}
          {pending ? "Đang lưu…" : uploadFailed ? "Thử lại" : "Lưu nháp"}
        </button>
      )}
    >
      <form id="background-editor-form" onSubmit={save} noValidate className="space-y-6">
        <CatalogErrorSummary errors={errors} summaryRef={summaryRef} />

        <div>
          <label htmlFor="catalog-label" className="text-sm font-semibold">Tên hiển thị</label>
          <input id="catalog-label" value={form.label} placeholder="Attack on titan" onChange={(event) => set("label", event.target.value)} maxLength={120} disabled={pending} aria-invalid={errors.some((error) => error.id === "catalog-label")} className={fieldClass} />
          <CatalogInlineError id="catalog-label" errors={errors} />
        </div>
        <div>
          <label htmlFor="catalog-mood-tags" className="text-sm font-semibold">Mood tags</label>
          <input id="catalog-mood-tags" value={form.moodTags} onChange={(event) => set("moodTags", event.target.value)} disabled={pending} placeholder="huyền bí, đêm, rừng" className={fieldClass} />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">Phân tách bằng dấu phẩy, tối đa 20 tag.</p>
        </div>
        <div>
          <label htmlFor="background-kind" className="text-sm font-semibold">Loại bối cảnh</label>
          <div className="relative mt-1.5">
            <select id="background-kind" value={form.kind} onChange={(event) => changeKind(event.target.value as BackgroundType)} disabled={pending} className={selectClass}>
              <option value="image">Ảnh</option>
              <option value="video">Video lặp</option>
              <option value="gradient">Linear gradient</option>
              <option value="radial_gradient">Radial gradient</option>
              <option value="particle_composition">Particle composition</option>
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          </div>
        </div>

        {form.kind === "image" || form.kind === "video" ? (
          <fieldset className="space-y-4 rounded-2xl border border-[var(--color-border)] p-4">
            <legend className="px-1 text-sm font-bold">Tệp media</legend>
            <SceneCatalogMediaField
              id="background-file"
              label={form.kind === "image" ? "Ảnh nền" : "Video nền"}
              kind={form.kind}
              file={primaryFile}
              currentPreviewUrl={item?.render.render_data.kind === form.kind
                ? item.render.render_data.media_url
                : undefined}
              disabled={pending}
              error={errors.find((error) => error.id === "background-file")?.message}
              onFileChange={(file) => {
                setPrimaryFile(file);
                if (!file && form.kind === "video") {
                  setPosterFile(null);
                  setFileError("background-poster", null);
                }
              }}
              onFileError={(message) => setFileError("background-file", message)}
            />
            <CatalogInlineError id="background-file" errors={errors} />
            {form.kind === "video" ? (
              <>
                <SceneCatalogMediaField
                  id="background-poster"
                  label="Poster dùng khi giảm chuyển động"
                  kind="image"
                  file={posterFile}
                  currentPreviewUrl={!primaryFile && item?.render.render_data.kind === "video"
                    ? item.render.poster_frame
                    : undefined}
                  disabled={pending}
                  error={errors.find((error) => error.id === "background-poster")?.message}
                  onFileChange={setPosterFile}
                  onFileError={(message) => setFileError("background-poster", message)}
                />
                <CatalogInlineError id="background-poster" errors={errors} />
              </>
            ) : null}
            {form.kind === "image" && item?.render.render_data.kind === "image" && item.render.motion === "looping" && !primaryFile ? (
              <div className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/45 p-3 text-xs leading-5 text-[var(--color-muted-foreground)]">
                <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Đây là bối cảnh ảnh từ dữ liệu legacy. Preview bên dưới phản ánh chuyển động thật trong Reader; thumbnail ở danh sách được giữ tĩnh để dễ quản lý.</p>
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {form.kind === "gradient" || form.kind === "radial_gradient" ? (
          <fieldset id="background-stops" className="space-y-4 rounded-2xl border border-[var(--color-border)] p-4">
            <legend className="px-1 text-sm font-bold">Cấu hình gradient</legend>
            {form.kind === "gradient" ? (
              <div>
                <label htmlFor="background-angle" className="block text-sm font-semibold">Góc (0–360°)</label>
                <input id="background-angle" type="number" min="0" max="360" step="1" value={form.angleDeg} onChange={(event) => set("angleDeg", Number(event.target.value))} aria-invalid={errors.some((error) => error.id === "background-angle")} className={fieldClass} />
                <CatalogInlineError id="background-angle" errors={errors} />
              </div>
            ) : (
              <div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm font-semibold">Hình dạng
                    <div className="relative mt-1.5">
                      <select value={form.shape} onChange={(event) => set("shape", event.target.value as "circle" | "ellipse")} className={selectClass}>
                        <option value="circle">Circle</option>
                        <option value="ellipse">Ellipse</option>
                      </select>
                      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
                    </div>
                  </label>
                  <label className="text-sm font-semibold">Tâm X<input id="background-center-x" type="number" min="0" max="1" step="0.05" value={form.centerX} onChange={(event) => set("centerX", Number(event.target.value))} aria-invalid={errors.some((error) => error.id === "background-center")} className={fieldClass} /></label>
                  <label className="text-sm font-semibold">Tâm Y<input id="background-center-y" type="number" min="0" max="1" step="0.05" value={form.centerY} onChange={(event) => set("centerY", Number(event.target.value))} aria-invalid={errors.some((error) => error.id === "background-center")} className={fieldClass} /></label>
                </div>
                <CatalogInlineError id="background-center" errors={errors} />
              </div>
            )}
            <div className="space-y-3">
              {form.stops.map((stop, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-end gap-2">
                  <label className="text-xs font-semibold">Màu {index + 1}<span className="mt-1 flex gap-2"><input type="color" value={/^#[0-9a-f]{6}$/i.test(stop.color) ? stop.color : "#000000"} onChange={(event) => updateStop(index, { color: event.target.value })} className="h-11 w-12 rounded-lg border border-[var(--color-border)] bg-transparent p-1" /><input value={stop.color} onChange={(event) => updateStop(index, { color: event.target.value })} className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-2 font-mono text-xs" /></span></label>
                  <label className="text-xs font-semibold">Vị trí<input type="number" min="0" max="1" step="0.05" value={stop.position} onChange={(event) => updateStop(index, { position: Number(event.target.value) })} className={fieldClass} /></label>
                  <button type="button" onClick={() => set("stops", form.stops.filter((_, stopIndex) => stopIndex !== index))} disabled={form.stops.length <= 2} aria-label={`Xóa điểm màu ${index + 1}`} className="mb-0 flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-muted)] disabled:opacity-35"><XCircle aria-hidden="true" className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => set("stops", [...form.stops, { color: "#64748B", position: 1 }])} disabled={form.stops.length >= 8} className="min-h-11 rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-muted)] disabled:opacity-50">Thêm điểm màu</button>
            <CatalogInlineError id="background-stops" errors={errors} />
          </fieldset>
        ) : null}

        {form.kind === "particle_composition" ? (
          <fieldset className="space-y-4 rounded-2xl border border-[var(--color-border)] p-4">
            <legend className="px-1 text-sm font-bold">Particle đã đăng ký</legend>
            <label className="block text-sm font-semibold">Composition
              <div className="relative mt-1.5">
                <select value={form.compositionKey} onChange={(event) => set("compositionKey", event.target.value as BackgroundFormState["compositionKey"])} className={selectClass}>
                  <option value="fireflies_green">Fireflies Green</option>
                  <option value="abyss_particles">Abyss Particles</option>
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
              </div>
            </label>
            <label className="block text-sm font-semibold">Chuyển động
              <div className="relative mt-1.5">
                <select value={form.particleMotion} onChange={(event) => set("particleMotion", event.target.value as "static" | "looping")} className={selectClass}>
                  <option value="static">Tĩnh</option>
                  <option value="looping">Lặp</option>
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
              </div>
            </label>
            {form.particleMotion === "looping" ? (
              <div>
                <SceneCatalogMediaField
                  id="background-poster"
                  label="Poster giảm chuyển động"
                  kind="image"
                  file={posterFile}
                  currentPreviewUrl={item?.render.render_data.kind === "particle_composition"
                    ? item.render.poster_frame
                    : undefined}
                  disabled={pending}
                  error={errors.find((error) => error.id === "background-poster")?.message}
                  onFileChange={setPosterFile}
                  onFileError={(message) => setFileError("background-poster", message)}
                />
                <CatalogInlineError id="background-poster" errors={errors} />
              </div>
            ) : null}
            <p className="text-xs text-[var(--color-muted-foreground)]">Config kỹ thuật được khóa theo registry; biểu mẫu không nhận CSS hoặc JSON tùy ý.</p>
          </fieldset>
        ) : null}

        {uploadProgress ? (
          <div aria-live="polite" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-muted)]/35 p-4">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold"><span className="flex items-center gap-2"><UploadCloud aria-hidden="true" className="h-4 w-4" />{uploadProgress.processing ? "Đang xác minh tệp…" : "Đang tải lên…"}</span><span>{uploadProgress.primary}%</span></div>
            <progress value={uploadProgress.primary} max={100} className="mt-2 h-2 w-full accent-[var(--color-primary)]" />
            {uploadProgress.poster !== undefined ? <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">Poster: {uploadProgress.poster}%</p> : null}
            {pending && !uploadProgress.processing ? <button type="button" onClick={() => abortRef.current?.abort()} className="mt-3 min-h-11 rounded-xl border border-[var(--color-destructive)] px-3 text-sm font-semibold text-[var(--color-destructive)]">Hủy upload</button> : null}
          </div>
        ) : null}

        <SceneCatalogPreview key={JSON.stringify(preview) ?? "empty"} background={preview} label="Xem trước Background" />
      </form>
    </SceneCatalogDrawerShell>
  );
}
