import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@onecalendar/crypto", "@onecalendar/types"],
};

export default nextConfig;
