import { MetadataRoute } from "next";
import fs from "fs";
import path from "path";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://calendar.xyehr.cn";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const getFileModDate = (filePath: string) => {
    try {
      const stats = fs.statSync(path.join(process.cwd(), filePath));
      return new Date(stats.mtime);
    } catch (e) {
      return new Date();
    }
  };

  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: getFileModDate("app/page.tsx"),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: getFileModDate("app/about/page.tsx"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: getFileModDate("app/privacy/page.tsx"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: getFileModDate("app/terms/page.tsx"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/app`,
      lastModified: getFileModDate("app/app/page.tsx"),
      changeFrequency: "daliy",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/sign-in`,
      lastModified: getFileModDate("app/sign-in/page.tsx"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/sign-up`,
      lastModified: getFileModDate("app/sign-up/page.tsx"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  return [...routes];
}
