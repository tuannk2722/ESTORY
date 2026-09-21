import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { freesoundConfig } from "@/lib/integrations/freesound/runtime";
import { decryptCredential } from "@/lib/integrations/freesound/crypto";
import { connectFreesound } from "@/lib/integrations/freesound/oauth";
export async function GET(request: Request) {
  let connected = false;
  let origin = new URL(request.url).origin;
  try {
    const { user } = await requireRole("author");
    const config = freesoundConfig(); origin = config.origin;
    const jar = await cookies();
    const cookie = jar.get("freesound-oauth")?.value;
    jar.set("freesound-oauth", "", { maxAge: 0, path: "/api/integrations/freesound", httpOnly: true, sameSite: "lax", secure: origin.startsWith("https:") });
    if (!cookie) throw new Error("Missing state");
    const state = z.object({ state: z.string(), expires: z.number() }).parse(JSON.parse(decryptCredential(cookie, config.key, `${user.id}:oauth`)));
    const params = new URL(request.url).searchParams;
    const code = params.get("code");
    if (params.get("state") !== state.state || state.expires < Date.now() || !code || code.length > 1000) throw new Error("Invalid state");
    await connectFreesound(user.id, code); connected = true;
  } catch { /* No provider error, authorization code or credential is reflected. */ }
  const nonce = randomBytes(16).toString("base64");
  const message = connected ? "Đã kết nối Freesound. Bạn có thể đóng cửa sổ này." : "Không thể kết nối Freesound. Đóng cửa sổ và thử lại.";
  return new Response(`<!doctype html><html lang="vi"><meta charset="utf-8"><title>Freesound</title><body><p>${message}</p><script nonce="${nonce}">if(window.opener){window.opener.postMessage({type:"freesound-connection",connected:${connected}},${JSON.stringify(origin)});window.close();}</script></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'` },
  });
}
