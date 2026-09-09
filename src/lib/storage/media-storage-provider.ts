export interface PresignPutInput {
  key: string;
  contentType: string;
  expiresInSeconds: number;
}

export interface PresignedPut {
  url: string;
  headers: Record<string, string>;
}

export interface StorageObjectHead {
  size: number;
  contentType?: string;
  etag?: string;
}

export interface MediaStorageProvider {
  presignPut(input: PresignPutInput): Promise<PresignedPut>;
  headObject(key: string): Promise<StorageObjectHead | null>;
  readObject(key: string, maxBytes: number): Promise<Uint8Array>;
  deleteObject(key: string): Promise<void>;
  publicUrl(key: string): string;
}
