import "server-only";
import { z } from "zod";
import { CommandError } from "@/lib/services/command-error";

const mediaUrl = z.url().refine((v) => {
  const u = new URL(v);
  return u.protocol === "https:" && !u.username && !u.password && (u.hostname === "freesound.org" || u.hostname.endsWith(".freesound.org"));
});
export const soundSchema = z.object({
  id: z.number().int().positive(), name: z.string().min(1).max(500), username: z.string().min(1).max(200),
  url: mediaUrl, license: z.url(), duration: z.number().positive(), filesize: z.number().nonnegative().optional(),
  type: z.string().optional(), previews: z.object({ "preview-hq-mp3": mediaUrl }),
});
export type FreesoundSound = z.infer<typeof soundSchema>;
export const searchResultsSchema = z.object({ count: z.number().int().nonnegative(), results: z.array(soundSchema), next: z.string().nullable() }).transform((r) => ({ count: r.count, results: r.results, hasMore: r.next !== null }));
const fields = "id,name,username,url,license,duration,filesize,type,previews";

export async function boundedResponse(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.ok || !response.body) throw new CommandError(503, "FREESOUND_UNAVAILABLE", "Freesound request failed; try again later");
  if (Number(response.headers.get("content-length")) > limit) { await response.body.cancel(); throw new CommandError(413, "AUDIO_TOO_LARGE", "Audio exceeds the import limit"); }
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new CommandError(413, "AUDIO_TOO_LARGE", "Audio exceeds the import limit");
      parts.push(value);
    }
    return Buffer.concat(parts);
  } finally { await reader.cancel().catch(() => {}); }
}

export class FreesoundClient {
  constructor(private readonly appToken: string, private readonly request: typeof fetch = fetch) {}
  async json(path: string, accessToken?: string) {
    const response = await this.request(`https://freesound.org/apiv2/${path}`, {
      headers: { Authorization: `${accessToken ? "Bearer" : "Token"} ${accessToken ?? this.appToken}` },
      signal: AbortSignal.timeout(12_000), cache: "no-store", redirect: "error",
    });
    if (response.status === 401 && accessToken) { await response.body?.cancel(); throw new CommandError(409, "FREESOUND_RECONNECT", "Reconnect your Freesound account"); }
    if (!response.ok) { await response.body?.cancel(); throw new CommandError(503, `FREESOUND_HTTP_${response.status}`, "Freesound request failed; try again later"); }
    const bytes = await boundedResponse(response, 1_000_000);
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  }
  async search(q: string, page: number) {
    const params = new URLSearchParams({ query: q, page: String(page), page_size: "12", fields, filter: "duration:[0 TO 300]" });
    return searchResultsSchema.parse(await this.json(`search/?${params}`));
  }
  async sound(id: string) {
    if (!/^[1-9][0-9]{0,9}$/.test(id)) throw new CommandError(400, "INVALID_SOUND", "Invalid sound ID");
    return soundSchema.parse(await this.json(`sounds/${id}/?fields=${fields}`));
  }
  async download(id: number, accessToken: string) {
    let url = `https://freesound.org/apiv2/sounds/${id}/download/`;
    for (let hop = 0; hop < 4; hop++) {
      const response = await this.request(url, { headers: hop === 0 ? { Authorization: `Bearer ${accessToken}` } : {}, redirect: "manual", signal: AbortSignal.timeout(30_000), cache: "no-store" });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) break;
        url = mediaUrl.parse(new URL(location, url).href);
        continue;
      }
      return boundedResponse(response, 64 * 1024 * 1024);
    }
    throw new CommandError(503, "FREESOUND_DOWNLOAD_FAILED", "Could not download this sound");
  }
}
