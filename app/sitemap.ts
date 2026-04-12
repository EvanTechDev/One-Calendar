import fs from "fs";
import path from "path";
import { MetadataRoute } from "next";

const DEFAULT_BASE_URL = "https://calendar.xyehr.cn";
const baseUrl = new URL(
  process.env.NEXT_PUBLIC_BASE_URL ?? DEFAULT_BASE_URL,
).toString();
const appDirectory = path.join(process.cwd(), "app");
const fallbackDate = new Date();

export const revalidate = 86400;

type SitemapRoute = {
  pathname: string;
  filePath: string[];
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
};

const sitemapRoutes: SitemapRoute[] = [
  {
    pathname: "/",
    filePath: ["page.tsx"],
    changeFrequency: "daily",
    priority: 1,
  },
  {
    pathname: "/app",
    filePath: ["(app)", "app", "page.tsx"],
    changeFrequency: "daily",
    priority: 1,
  },
  {
    pathname: "/privacy",
    filePath: ["(app)", "privacy", "page.tsx"],
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    pathname: "/terms",
    filePath: ["(app)", "terms", "page.tsx"],
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    pathname: "/sign-in",
    filePath: ["(auth)", "sign-in", "page.tsx"],
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    pathname: "/sign-up",
    filePath: ["(auth)", "sign-up", "page.tsx"],
    changeFrequency: "monthly",
    priority: 0.7,
  },
];

const getFileModDate = (...segments: string[]) => {
  try {
    const stats = fs.statSync(path.join(appDirectory, ...segments));
    return new Date(stats.mtime);
  } catch {
    return fallbackDate;
  }
};

const toAbsoluteUrl = (pathname: string) => new URL(pathname, baseUrl).toString();

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapRoutes.map((route) => ({
    url: toAbsoluteUrl(route.pathname),
    lastModified: getFileModDate(...route.filePath),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
