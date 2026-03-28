import { MetadataRoute } from "next";
import fs from "fs";
import path from "path";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://calendar.xyehr.cn";
const appDirectory = path.join(process.cwd(), "app");

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const getFileModDate = (...segments: string[]) => {
    try {
      const stats = fs.statSync(path.join(appDirectory, ...segments));
      return new Date(stats.mtime);
    } catch {
      return new Date();
    }
  };

  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: getFileModDate("page.tsx"),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: getFileModDate("about", "page.tsx"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: getFileModDate("privacy", "page.tsx"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: getFileModDate("terms", "page.tsx"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/app`,
      lastModified: getFileModDate("app", "page.tsx"),
      changeFrequency: "daliy",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/sign-in`,
      lastModified: getFileModDate("sign-in", "page.tsx"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/sign-up`,
      lastModified: getFileModDate("sign-up", "page.tsx"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  return [...routes];
}
