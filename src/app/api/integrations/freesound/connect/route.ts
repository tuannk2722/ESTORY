import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/guards";
import { commandFailure } from "@/lib/http/command-response";
import { freesoundConfig } from "@/lib/integrations/freesound/runtime";
import { encryptCredential } from "@/lib/integrations/freesound/crypto";
export async function GET(request: Request) {
  try {
    const { user } = await requireRole("author");
    const config = freesoundConfig();
    // Only same-origin user navigation may initiate an account-linking flow.
    if (request.headers.get("sec-fetch-site") === "cross-site") return new Response(null, { status: 403 });
    const state = randomBytes(32).toString("base64url");
    const jar = await cookies();
    jar.set("freesound-oauth", encryptCredential(JSON.stringify({ state, expires: Date.now() + 600_000 }), config.key, `${user.id}:oauth`), {
      httpOnly: true, secure: config.origin.startsWith("https:"), sameSite: "lax", path: "/api/integrations/freesound", maxAge: 600,
    });
    const url = new URL("https://freesound.org/apiv2/oauth2/authorize/");
    url.search = new URLSearchParams({ client_id: config.clientId, response_type: "code", state }).toString();
    return Response.redirect(url, 302);
  } catch (e) { return commandFailure(e); }
}
