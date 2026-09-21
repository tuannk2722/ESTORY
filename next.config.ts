import type { NextConfig } from "next";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// pnpm exposes node_modules/ffmpeg-static as a directory symlink. Include the
// binary at its real package location so the deployment does not also contain
// file entries underneath that symlink. Next traces the package link itself.
const projectRoot = process.cwd();
const requireFromProject = createRequire(path.join(projectRoot, "package.json"));
const ffmpegDirectory = realpathSync(path.dirname(requireFromProject.resolve("ffmpeg-static/package.json")));
const ffmpegFiles = `${path.relative(projectRoot, ffmpegDirectory).split(path.sep).join("/")}/ffmpeg*`;

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/integrations/freesound/import": [ffmpegFiles],
    "/api/admin/audio-transcode-spike": [ffmpegFiles],
  },
};

export default nextConfig;
