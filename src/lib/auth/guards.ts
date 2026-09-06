import "server-only";
import { auth } from "@/lib/services/auth";
import { createSessionGuards } from "./policy";

export const { requireSession, requireRole } = createSessionGuards(() => auth());
