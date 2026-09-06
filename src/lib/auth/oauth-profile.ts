import { z } from "zod";

const githubEmailsSchema = z.array(z.object({ email: z.string().email(), verified: z.boolean() }));

/** Email allowlists require provider proof, including GitHub private emails. */
export async function isVerifiedOAuthEmail(
  provider: string | undefined,
  email: string | null | undefined,
  profile: Record<string, unknown> | undefined,
  accessToken: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!email || !z.string().email().safeParse(email).success) return false;
  if (provider === "google") return profile?.email_verified === true
    && typeof profile.email === "string" && profile.email.toLowerCase() === email.toLowerCase();
  if (provider !== "github" || !accessToken) return false;
  try {
    const response = await fetcher("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "User-Agent": "storytelling-auth" },
      signal: AbortSignal.timeout(10_000), cache: "no-store",
    });
    if (!response.ok) return false;
    const result = githubEmailsSchema.safeParse(await response.json());
    return result.success && result.data.some((entry) => entry.verified && entry.email.toLowerCase() === email.toLowerCase());
  } catch {
    return false;
  }
}
