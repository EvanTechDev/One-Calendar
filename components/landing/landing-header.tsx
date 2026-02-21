const navLinks = ["Product", "Features", "Pricing", "About"];

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[var(--landing-bg)]/90 py-6 backdrop-blur">
      <nav className="flex items-center justify-between">
        <a
          href="#"
          className="text-lg font-semibold tracking-tight transition hover:brightness-125"
          aria-label="One Calendar home"
        >
          One Calendar
        </a>
        <div className="hidden items-center gap-8 text-sm text-[var(--landing-muted)] md:flex">
          {navLinks.map((link) => (
            <a
              key={link}
              href="#"
              className="transition duration-200 hover:-translate-y-0.5 hover:text-white"
            >
              {link}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/sign-in"
            aria-label="Log in"
            className="text-sm text-[var(--landing-muted)] transition duration-200 hover:-translate-y-0.5 hover:text-white"
          >
            Log in
          </a>
          <a
            href="/sign-up"
            aria-label="Sign up"
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition duration-200 hover:-translate-y-0.5 hover:brightness-110"
          >
            Sign up
          </a>
        </div>
      </nav>
    </header>
  );
}
