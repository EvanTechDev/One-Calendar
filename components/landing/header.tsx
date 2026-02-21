import { LandingLogoIcon } from "./logo-icon";

const navLinks = [
  { label: "Overview", href: "#features" },
  { label: "Features", href: "#features" },
  { label: "Data", href: "#data" },
  { label: "FAQ", href: "#faq" },
  { label: "Deep Dive", href: "#deep-dive" },
  { label: "About", href: "/about" },
];

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--landing-bg)]/90 py-4 backdrop-blur">
      <nav className="flex items-center justify-between gap-6">
        <a href="#top" aria-label="One Calendar home" className="flex items-center gap-2 text-white transition hover:brightness-110">
          <LandingLogoIcon className="h-5 w-5" />
          <span className="text-lg font-semibold tracking-tight">One Calendar</span>
        </a>

        <div className="hidden items-center gap-7 text-sm text-[var(--landing-muted)] md:flex">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="transition duration-200 hover:-translate-y-0.5 hover:text-white">
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a href="/sign-in" aria-label="Log in" className="text-sm text-[var(--landing-muted)] transition duration-200 hover:-translate-y-0.5 hover:text-white">
            Log in
          </a>
          <a
            href="/sign-up"
            aria-label="Sign up"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition duration-200 hover:-translate-y-0.5 hover:brightness-110"
          >
            Sign up
          </a>
        </div>
      </nav>
    </header>
  );
}
