const navLinks = ["Product", "Resources", "Customers", "Pricing", "Now", "Contact"];

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="white" />
      <path d="M4.5 8.4 15.6 19.5M4.5 12l7.5 7.5M4.5 15.5l4 4" stroke="black" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--landing-bg)]/90 py-5 backdrop-blur">
      <nav className="flex items-center justify-between gap-6">
        <a href="#" aria-label="One Calendar home" className="flex items-center gap-2 text-white transition hover:brightness-110">
          <LogoMark />
          <span className="text-xl font-semibold leading-none tracking-tight sm:text-2xl">One Calendar</span>
        </a>

        <div className="hidden items-center gap-8 text-sm text-[var(--landing-muted)] lg:flex">
          {navLinks.map((link) => (
            <a key={link} href="#" className="transition duration-200 hover:-translate-y-0.5 hover:text-white">
              {link}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden h-6 w-px bg-white/15 md:block" aria-hidden="true" />
          <a href="/sign-in" aria-label="Log in" className="text-sm text-[var(--landing-muted)] transition duration-200 hover:-translate-y-0.5 hover:text-white">
            Log in
          </a>
          <a
            href="/sign-up"
            aria-label="Sign up"
            className="rounded-md bg-white px-5 py-2.5 text-sm font-medium text-black transition duration-200 hover:-translate-y-0.5 hover:brightness-110"
          >
            Sign up
          </a>
        </div>
      </nav>
    </header>
  );
}
