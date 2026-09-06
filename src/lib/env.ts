import "server-only";
import { parseEnvironment } from "./config/environment";

export const serverEnv = parseEnvironment(process.env);
