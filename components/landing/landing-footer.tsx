const footerColumns = [
  { title: "Product", links: ["Overview", "Integrations", "Security", "Changelog"] },
  { title: "Company", links: ["About", "Customers", "Careers", "Blog"] },
  { title: "Resources", links: ["Documentation", "API", "Status", "Support"] },
  { title: "Connect", links: ["Contact", "Community", "GitHub", "X (Twitter)"] },
];

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="white" />
      <path d="M4.5 8.4 15.6 19.5M4.5 12l7.5 7.5M4.5 15.5l4 4" stroke="black" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LandingFooter() {
  return (
    <footer className="px-6 pb-10 pt-12 text-[var(--landing-subtle)] md:px-10">
      <div className="mx-auto max-w-7xl border-t border-white/10 pt-10">
        <div className="grid gap-10 md:grid-cols-5">
          <div>
            <a href="#" aria-label="One Calendar home" className="inline-flex items-center gap-2 text-white transition hover:brightness-110">
              <LogoMark />
              <span className="text-sm font-medium">One Calendar</span>
            </a>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-medium text-white">{column.title}</p>
              <ul className="mt-4 space-y-3 text-sm text-[var(--landing-muted)]">
                {column.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="transition duration-200 hover:-translate-y-0.5 hover:text-white">
                      {link}
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
