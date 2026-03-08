import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "One Calendar",
    short_name: "One Calendar",
    description: "All your events in one place, beautifully organized.",
    id: "/app",
    start_url: "/app",
    scope: "/app",
    display: "standalone",
    orientation: "landscape",
    background_color: "#0b0f1a",
    theme_color: "#0b0f1a",
    lang: "en",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
