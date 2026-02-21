import Image from "next/image";
import { LandingTitle } from "./landing-title";

const footerColumns = [
  { title: "Product", links: [{ label: "Overview", href: "#features" }, { label: "About", href: "/about" }] },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "https://docs.xyehr.cn/docs/one-calendar" },
      { label: "Status", href: "https://calendarstatus.xyehr.cn" },
      { label: "Support", href: "mailto:evan.huang000@proton.me" },
    ],
  },
  {
    title: "Connect",
    links: [
      { label: "Contact", href: "mailto:evan.huang000@proton.me" },
      { label: "Bluesky", href: "https://bsky.app/profile/calendar.xyehr.cn" },
      { label: "GitHub", href: "https://github.com/EvanTechDev/One-Calendar" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="px-6 pb-10 pt-12 text-[var(--landing-subtle)] md:px-10">
      <div className="mx-auto max-w-7xl border-t border-white/10 pt-10">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <a href="#top" aria-label="One Calendar home" className="inline-flex items-center gap-2 text-white transition hover:brightness-110">
              <Image src="/icon.svg" alt="One Calendar logo" width={20} height={20} className="h-5 w-5" />
              <span className="text-sm font-medium">One Calendar</span>
            </a>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <LandingTitle as="p" className="text-sm font-medium text-white">{column.title}</LandingTitle>
              <ul className="mt-4 space-y-3 text-sm text-[var(--landing-muted)]">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="transition duration-200 hover:-translate-y-0.5 hover:text-white">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-white/10 pt-5 text-xs text-[var(--landing-subtle)]">
          <a href="#" className="transition hover:text-white">Privacy</a>
          <a href="#" className="transition hover:text-white">Terms</a>
          <p>© {new Date().getFullYear()} One Calendar. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
