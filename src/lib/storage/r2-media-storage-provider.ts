import "server-only";
import {
  DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { IMMUTABLE_CACHE_CONTROL } from "@/lib/media/constants";
import type { MediaStorageProvider, PresignPutInput, PresignedPut, StorageObjectHead } from "./media-storage-provider";

export interface R2MediaStorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export class R2MediaStorageProvider implements MediaStorageProvider {
  private readonly client: S3Client;

  constructor(private readonly config: R2MediaStorageConfig) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async presignPut(input: PresignPutInput): Promise<PresignedPut> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: input.key,
      ContentType: input.contentType,
      CacheControl: IMMUTABLE_CACHE_CONTROL,
      IfNoneMatch: "*",
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds,
      signableHeaders: new Set(["content-type", "cache-control", "if-none-match"]),
    });
    return {
      url,
      headers: {
        "Content-Type": input.contentType,
        "Cache-Control": IMMUTABLE_CACHE_CONTROL,
        "If-None-Match": "*",
      },
    };
  }

  async headObject(key: string): Promise<StorageObjectHead | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      if (result.ContentLength === undefined) throw new Error("R2 object is missing Content-Length");
      return {
        size: result.ContentLength,
        ...(result.ContentType ? { contentType: result.ContentType } : {}),
        ...(result.ETag ? { etag: result.ETag.replace(/^\"|\"$/g, "") } : {}),
      };
    } catch (error) {
      const status = error && typeof error === "object" && "$metadata" in error
        ? (error.$metadata as { httpStatusCode?: number }).httpStatusCode
        : undefined;
      if (status === 404) return null;
      throw error;
    }
  }

  async readObject(key: string, maxBytes: number): Promise<Uint8Array> {
    if (!Number.isInteger(maxBytes) || maxBytes < 1) throw new Error("Invalid storage read limit");
    const result = await this.client.send(new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Range: `bytes=0-${maxBytes - 1}`,
    }));
    if (!result.Body) throw new Error("R2 object has no body");
    const bytes = await result.Body.transformToByteArray();
    if (bytes.byteLength > maxBytes) throw new Error("R2 range response exceeded the requested limit");
    return bytes;
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  publicUrl(key: string): string {
    return `${this.config.publicBaseUrl.replace(/\/$/, "")}/${encodeKey(key)}`;
  }
}
