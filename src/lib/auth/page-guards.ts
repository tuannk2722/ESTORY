import "server-only";
import { redirect, notFound } from "next/navigation";
import { StoryDataAccess } from "@/lib/services/story-dal";
import { CommandError } from "@/lib/services/command-error";
import type { Role } from "@/types/user";
import { requireRole } from "./guards";
import { AuthAccessError } from "./policy";

export async function requirePageRole(minRole: Role, callbackUrl: string) {
  try {
    return await requireRole(minRole);
  } catch (error) {
    if (!(error instanceof AuthAccessError)) throw error;
    if (error.status === 401) redirect(`/api/auth/signin?${new URLSearchParams({ callbackUrl })}`);
    redirect("/");
  }
}

export function requirePageStoryAccess(storyId: string, callbackUrl: string): ReturnType<typeof requirePageRole>;
export function requirePageStoryAccess(storyId: string, chapterId: string, callbackUrl: string): ReturnType<typeof requirePageRole>;
export async function requirePageStoryAccess(storyId: string, chapterIdOrCallbackUrl: string, callbackUrl?: string) {
  const chapterId = callbackUrl === undefined ? undefined : chapterIdOrCallbackUrl;
  const resolvedCallbackUrl = callbackUrl ?? chapterIdOrCallbackUrl;
  const session = await requirePageRole("author", resolvedCallbackUrl);
  try {
    await new StoryDataAccess().authorize(session.user.id, storyId, chapterId);
  } catch (error) {
    if (error instanceof CommandError && error.status === 404) notFound();
    if (error instanceof AuthAccessError) redirect("/");
    throw error;
  }
  return session;
}
