"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { translations, useLanguage } from "@/lib/i18n";

export default function NotFound() {
  const [language] = useLanguage();
  const t = translations[language];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <div className="fixed -z-10 inset-0">
        <div className="absolute inset-0 bg-white dark:bg-black">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.1) 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          />
          <div
            className="absolute inset-0 dark:block hidden"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          />
        </div>
      </div>
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">{t.notFoundTitle}</h2>
      <p className="text-gray-500 mb-6">{t.notFoundDescription}</p>
      <Link href="/" passHref>
        <Button variant="outline">{t.notFoundButton}</Button>
      </Link>
    </div>
  );
}
