import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@onecalendar/crypto", "@onecalendar/types", "@onecalendar/i18n"],
};

export default nextConfig;
