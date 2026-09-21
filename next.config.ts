import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/integrations/freesound/import": ["./node_modules/ffmpeg-static/ffmpeg*"],
    "/api/admin/audio-transcode-spike": ["./node_modules/ffmpeg-static/ffmpeg*"],
  },
};

export default nextConfig;
