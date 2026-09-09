import assert from "node:assert/strict";
import { CommandError } from "@/lib/services/command-error";
import { UploadService } from "@/lib/services/upload";
import type {
  CreatedMediaUpload, CreateMediaUploadInput, MediaUploadStore,
} from "@/lib/repositories/media-upload-store";
import type {
  MediaStorageProvider, PresignPutInput, PresignedPut, StorageObjectHead,
} from "@/lib/storage/media-storage-provider";
import type { CompletedMediaUpload, MediaUploadRecord } from "@/types/media";
import type { SessionUser } from "@/lib/auth/policy";
import { BACKGROUND_VIDEO_MAX_BYTES, PERSONAL_VIDEO_SLOT_LIMIT } from "@/lib/media/constants";
import { inspectMedia, MediaInspectionError } from "@/lib/media/inspect-media";

class FakeUploadStore implements MediaUploadStore {
  readonly records = new Map<string, MediaUploadRecord>();

  async create(input: CreateMediaUploadInput): Promise<CreatedMediaUpload> {
    let videoSlot: number | null = null;
    let videoQuotaUsed: number | undefined;
    if (input.reservePersonalVideoSlot) {
      const used = new Set([...this.records.values()].flatMap((record) =>
        record.ownerId === input.ownerId && record.videoSlot !== null ? [record.videoSlot] : []));
      videoSlot = Array.from({ length: PERSONAL_VIDEO_SLOT_LIMIT }, (_, index) => index + 1)
        .find((slot) => !used.has(slot)) ?? null;
      if (videoSlot === null) throw new CommandError(429, "VIDEO_UPLOAD_LIMIT_REACHED", "limit");
      videoQuotaUsed = used.size + 1;
    }
    const record: MediaUploadRecord = {
      ...input,
      videoSlot,
      status: "pending",
      result: null,
      completedAt: null,
    };
    this.records.set(record.id, record);
    return { record, ...(videoQuotaUsed === undefined ? {} : { videoQuotaUsed }) };
  }

  async getOwned(id: string, ownerId: string): Promise<MediaUploadRecord | null> {
    const record = this.records.get(id);
    return record?.ownerId === ownerId ? record : null;
  }

  async transition(
    record: MediaUploadRecord,
    expected: MediaUploadRecord["status"][],
    status: MediaUploadRecord["status"],
    releaseVideoSlot = false,
  ): Promise<MediaUploadRecord> {
    const current = this.records.get(record.id)!;
    if (!expected.includes(current.status)) return current;
    const updated = { ...current, status, videoSlot: releaseVideoSlot ? null : current.videoSlot };
    this.records.set(record.id, updated);
    return updated;
  }

  async complete(record: MediaUploadRecord, result: CompletedMediaUpload, completedAt: Date): Promise<MediaUploadRecord> {
    const updated = { ...record, status: "completed" as const, result, completedAt };
    this.records.set(record.id, updated);
    return updated;
  }

}

class FakeStorage implements MediaStorageProvider {
  readonly signed: PresignPutInput[] = [];
  readonly objects = new Map<string, { bytes: Uint8Array; contentType: string; etag: string }>();
  readonly deleted: string[] = [];
  failDelete = false;
  failPresign = false;
  failHead = false;

  async presignPut(input: PresignPutInput): Promise<PresignedPut> {
    if (this.failPresign) throw new Error("unavailable");
    this.signed.push(input);
    return {
      url: `https://upload.invalid/${encodeURIComponent(input.key)}?signature=secret`,
      headers: { "Content-Type": input.contentType, "If-None-Match": "*" },
    };
  }
  async headObject(key: string): Promise<StorageObjectHead | null> {
    if (this.failHead) throw new Error("head failed");
    const object = this.objects.get(key);
    return object ? { size: object.bytes.byteLength, contentType: object.contentType, etag: object.etag } : null;
  }
  async readObject(key: string, maxBytes: number): Promise<Uint8Array> {
    const object = this.objects.get(key);
    if (!object) throw new Error("missing");
    return object.bytes.subarray(0, maxBytes);
  }
  async deleteObject(key: string): Promise<void> {
    if (this.failDelete) throw new Error("delete failed");
    this.deleted.push(key);
    this.objects.delete(key);
  }
  publicUrl(key: string): string { return `https://media.example.test/${key}`; }
  put(record: MediaUploadRecord, role: "primary" | "poster", bytes: Uint8Array, contentType?: string) {
    const key = role === "primary" ? record.objectKey : record.posterObjectKey;
    if (!key) throw new Error("No poster key");
    this.objects.set(key, {
      bytes,
      contentType: contentType ?? (role === "primary" ? record.contentType : record.posterContentType!),
      etag: `${role}-etag`,
    });
  }
}

function png(width = 1280, height = 720): Uint8Array {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function mp4(): Uint8Array {
  const bytes = Buffer.alloc(16);
  bytes.writeUInt32BE(16, 0);
  bytes.write("ftyp", 4, "ascii");
  bytes.write("isom", 8, "ascii");
  return bytes;
}

function wav(durationMs: number): Uint8Array {
  const byteRate = 1000;
  const dataSize = Math.ceil(durationMs / 1000 * byteRate);
  const bytes = Buffer.alloc(44 + dataSize);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(36 + dataSize, 4);
  bytes.write("WAVE", 8, "ascii");
  bytes.write("fmt ", 12, "ascii");
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(1000, 24);
  bytes.writeUInt32LE(byteRate, 28);
  bytes.writeUInt16LE(1, 32);
  bytes.writeUInt16LE(8, 34);
  bytes.write("data", 36, "ascii");
  bytes.writeUInt32LE(dataSize, 40);
  return bytes;
}

const author: SessionUser = {
  id: "author-private-id", role: "author", email: "author@example.test", name: "Author", image: null,
};
const admin: SessionUser = { ...author, id: "admin-private-id", role: "admin", email: "admin@example.test" };
const outsider: SessionUser = { ...author, id: "outsider", email: "outsider@example.test" };

function setup(now = new Date("2026-09-09T00:00:00.000Z")) {
  const store = new FakeUploadStore();
  const storage = new FakeStorage();
  let sequence = 0;
  let clock = now;
  const service = new UploadService(store, storage, {
    keyPrefix: "test",
    now: () => clock,
    createId: () => `generated-${++sequence}`,
  });
  return { service, store, storage, advance(ms: number) { clock = new Date(clock.getTime() + ms); } };
}

function commandError(status: number, code: string) {
  return (error: unknown) => error instanceof CommandError && error.status === status && error.body.error.code === code;
}

export async function runMediaUploadTests() {
  {
    const { service } = setup();
    await assert.rejects(() => service.requestUpload(author, {
      purpose: "personal_background", file: { name: "loop.mp4", contentType: "video/mp4", size: 16 },
    }), commandError(400, "POSTER_REQUIRED"));
    await assert.rejects(() => service.requestUpload(author, {
      purpose: "personal_background", file: { name: "image.png", contentType: "image/png", size: 24 },
      poster: { name: "poster.png", contentType: "image/png", size: 24 },
    }), commandError(400, "POSTER_NOT_ALLOWED"));
    await assert.rejects(() => service.requestUpload(author, {
      purpose: "personal_background", file: { name: "fake.jpg", contentType: "video/mp4", size: 16 },
      poster: { name: "poster.png", contentType: "image/png", size: 24 },
    }), commandError(400, "MEDIA_EXTENSION_MISMATCH"));
    await assert.rejects(() => service.requestUpload(author, {
      purpose: "personal_background", file: { name: "large.mp4", contentType: "video/mp4", size: BACKGROUND_VIDEO_MAX_BYTES + 1 },
      poster: { name: "poster.png", contentType: "image/png", size: 24 },
    }), commandError(413, "MEDIA_TOO_LARGE"));
  }

  {
    const { service, store, storage } = setup();
    storage.failPresign = true;
    await assert.rejects(() => service.requestUpload(author, {
      purpose: "personal_background", file: { name: "loop.mp4", contentType: "video/mp4", size: 16 },
      poster: { name: "poster.png", contentType: "image/png", size: 24 },
    }), commandError(503, "MEDIA_STORAGE_UNAVAILABLE"));
    const rejected = [...store.records.values()][0];
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.videoSlot, null, "A presign failure cannot strand a video quota slot");
  }

  {
    const { service, store, storage } = setup();
    const requested = await service.requestUpload(author, {
      purpose: "personal_background", file: { name: "loop.mp4", contentType: "video/mp4", size: 16 },
      poster: { name: "poster.png", contentType: "image/png", size: 24 },
    });
    assert.equal(requested.parts.length, 2);
    assert.deepEqual(requested.videoQuota, { used: 1, limit: 10 });
    assert.ok(requested.parts.every((part) => part.headers["If-None-Match"] === "*"));
    const record = store.records.get(requested.uploadId)!;
    assert.equal(record.videoSlot, 1);
    assert.ok(record.objectKey.startsWith("test/personal_background/"));
    assert.ok(!record.objectKey.includes(author.id));
    storage.put(record, "primary", mp4());
    await assert.rejects(() => service.completeUpload(author, record.id), commandError(409, "UPLOAD_INCOMPLETE"));
    storage.put(record, "poster", png());
    const completed = await service.completeUpload(author, record.id);
    assert.equal(completed.media.kind, "video");
    assert.deepEqual({ width: completed.media.poster?.width, height: completed.media.poster?.height }, { width: 1280, height: 720 });
    assert.deepEqual(await service.completeUpload(author, record.id), completed, "complete is idempotent");
    await assert.rejects(() => service.cancelUpload(author, record.id), commandError(409, "UPLOAD_NOT_PENDING"));
    await assert.rejects(() => service.completeUpload(outsider, record.id), commandError(404, "NOT_FOUND"));
  }

  {
    const { service, store, storage } = setup();
    const requested = await service.requestUpload(author, {
      purpose: "personal_background", file: { name: "image.png", contentType: "image/png", size: 24 },
    });
    const record = store.records.get(requested.uploadId)!;
    storage.put(record, "primary", png(640, 360));
    const completed = await service.completeUpload(author, record.id);
    assert.deepEqual({ width: completed.media.primary.width, height: completed.media.primary.height }, { width: 640, height: 360 });
  }

  {
    const { service, store, storage } = setup();
    const requested = await service.requestUpload(author, {
      purpose: "story_cover", file: { name: "cover.png", contentType: "image/png", size: 24 },
    });
    const record = store.records.get(requested.uploadId)!;
    storage.put(record, "primary", png(), "image/jpeg");
    await assert.rejects(() => service.completeUpload(author, record.id), commandError(400, "UPLOAD_REJECTED"));
    assert.equal(store.records.get(record.id)?.status, "rejected");
    assert.equal(storage.objects.size, 0, "Metadata mismatch is physically cleaned");
  }

  {
    const { service, store, storage } = setup();
    const requested = await service.requestUpload(author, {
      purpose: "story_cover", file: { name: "cover.png", contentType: "image/png", size: 25 },
    });
    const record = store.records.get(requested.uploadId)!;
    storage.put(record, "primary", png());
    await assert.rejects(() => service.completeUpload(author, record.id), commandError(400, "UPLOAD_REJECTED"));
  }

  {
    const { service, store, storage } = setup();
    const requested = await service.requestUpload(author, {
      purpose: "story_cover", file: { name: "cover.png", contentType: "image/png", size: 24 },
    });
    const record = store.records.get(requested.uploadId)!;
    storage.put(record, "primary", png());
    storage.failHead = true;
    await assert.rejects(() => service.completeUpload(author, record.id), commandError(503, "MEDIA_STORAGE_UNAVAILABLE"));
    assert.equal(store.records.get(record.id)?.status, "pending", "Transient storage errors remain retryable");
  }

  {
    const { service, store, storage } = setup();
    const requested = await service.requestUpload(author, {
      purpose: "personal_background", file: { name: "loop.mp4", contentType: "video/mp4", size: 16 },
      poster: { name: "poster.png", contentType: "image/png", size: 24 },
    });
    const record = store.records.get(requested.uploadId)!;
    storage.put(record, "primary", png(1, 1), "video/mp4");
    storage.put(record, "poster", png());
    await assert.rejects(() => service.completeUpload(author, record.id), commandError(400, "UPLOAD_REJECTED"));
    assert.equal(store.records.get(record.id)?.status, "rejected");
    assert.equal(store.records.get(record.id)?.videoSlot, null);
    assert.equal(storage.objects.size, 0);
  }

  {
    const { service, store, storage, advance } = setup();
    const requested = await service.requestUpload(author, {
      purpose: "personal_background", file: { name: "loop.webm", contentType: "video/webm", size: 4 },
      poster: { name: "poster.png", contentType: "image/png", size: 24 },
    });
    const record = store.records.get(requested.uploadId)!;
    storage.put(record, "primary", Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]));
    advance(10 * 60 * 1000 + 1);
    await assert.rejects(() => service.completeUpload(author, record.id), commandError(409, "UPLOAD_EXPIRED"));
    assert.equal(store.records.get(record.id)?.status, "expired");
    assert.equal(store.records.get(record.id)?.videoSlot, null);
  }

  {
    const { service, store, storage } = setup();
    const requested = await service.requestUpload(author, {
      purpose: "personal_background", file: { name: "loop.mp4", contentType: "video/mp4", size: 16 },
      poster: { name: "poster.png", contentType: "image/png", size: 24 },
    });
    const record = store.records.get(requested.uploadId)!;
    storage.put(record, "primary", mp4());
    assert.deepEqual(await service.cancelUpload(author, record.id), { uploadId: record.id, status: "cancelled" });
    assert.equal(store.records.get(record.id)?.videoSlot, null);
    assert.deepEqual(await service.cancelUpload(author, record.id), { uploadId: record.id, status: "cancelled" });
    await assert.rejects(() => service.cancelUpload(outsider, record.id), commandError(404, "NOT_FOUND"));
  }

  {
    const { service, store, storage } = setup();
    const requested = await service.requestUpload(admin, {
      purpose: "global_background", file: { name: "image.png", contentType: "image/png", size: 24 },
    });
    const record = store.records.get(requested.uploadId)!;
    storage.put(record, "primary", png());
    await assert.rejects(
      () => service.completeUpload({ ...admin, role: "author" }, record.id),
      commandError(403, "FORBIDDEN"),
      "Role is checked again when an upload is completed",
    );
  }

  {
    const { service, store, storage } = setup();
    const requested = await service.requestUpload(author, {
      purpose: "personal_background", file: { name: "loop.mp4", contentType: "video/mp4", size: 16 },
      poster: { name: "poster.png", contentType: "image/png", size: 24 },
    });
    const record = store.records.get(requested.uploadId)!;
    storage.put(record, "primary", mp4());
    storage.failDelete = true;
    await service.cancelUpload(author, record.id);
    assert.equal(store.records.get(record.id)?.videoSlot, 1, "Failed physical cleanup must retain the quota slot");
    storage.failDelete = false;
    await service.cancelUpload(author, record.id);
    assert.equal(store.records.get(record.id)?.videoSlot, null, "Retrying a cancelled upload completes cleanup and releases the slot");
  }

  {
    const { service, store, storage } = setup();
    for (let index = 0; index < PERSONAL_VIDEO_SLOT_LIMIT; index += 1) {
      await service.requestUpload(author, {
        purpose: "personal_background", file: { name: "loop.mp4", contentType: "video/mp4", size: 16 },
        poster: { name: "poster.png", contentType: "image/png", size: 24 },
      });
    }
    await assert.rejects(() => service.requestUpload(author, {
      purpose: "personal_background", file: { name: "loop.mp4", contentType: "video/mp4", size: 16 },
      poster: { name: "poster.png", contentType: "image/png", size: 24 },
    }), commandError(429, "VIDEO_UPLOAD_LIMIT_REACHED"));
    const global = await service.requestUpload(admin, {
      purpose: "global_background", file: { name: "loop.mp4", contentType: "video/mp4", size: 16 },
      poster: { name: "poster.png", contentType: "image/png", size: 24 },
    });
    assert.equal(global.videoQuota, undefined);
    assert.equal(store.records.get(global.uploadId)?.videoSlot, null);
    assert.ok(storage.signed.length > 0);
  }

  {
    const reader = { ...author, role: "reader" as const };
    const { service } = setup();
    await assert.rejects(() => service.requestUpload(reader, {
      purpose: "personal_background", file: { name: "image.png", contentType: "image/png", size: 24 },
    }), commandError(403, "FORBIDDEN"));
    await service.requestUpload(reader, {
      purpose: "story_cover", file: { name: "cover.png", contentType: "image/png", size: 24 },
    });
  }

  assert.throws(() => inspectMedia("audio/wav", wav(300_001)), MediaInspectionError);
  assert.equal(inspectMedia("audio/wav", wav(5_000)).durationMs, 5_000);
  assert.throws(() => inspectMedia("video/mp4", png()), MediaInspectionError);

  console.log("Media upload unit tests passed");
}
