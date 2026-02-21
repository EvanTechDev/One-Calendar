const footerColumns = [
  { title: "Product", links: ["Intake", "Plan", "Build", "Reviews", "Monitor", "Pricing", "Security"] },
  { title: "Features", links: ["Asks", "Agents", "Requests", "Insights", "Mobile", "Integrations", "Changelog"] },
  { title: "Company", links: ["About", "Customers", "Careers", "Blog", "Method", "Quality", "Brand"] },
  { title: "Resources", links: ["Switch", "Download", "Documentation", "Developers", "Status", "Enterprise", "Startups"] },
  { title: "Connect", links: ["Contact us", "Community", "X (Twitter)", "GitHub", "YouTube"] },
];

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="white" />
      <path d="M4.5 8.4 15.6 19.5M4.5 12l7.5 7.5M4.5 15.5l4 4" stroke="black" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LandingFooter() {
  return (
    <footer className="px-6 pb-16 pt-14 text-[var(--landing-subtle)] md:px-10">
      <div className="mx-auto max-w-7xl border-t border-white/10 pt-14">
        <div className="grid gap-12 md:grid-cols-6">
          <div className="md:col-span-1">
            <a href="#" aria-label="One Calendar home" className="inline-flex transition hover:brightness-110">
              <LogoMark />
            </a>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <p className="text-base font-medium text-white md:text-lg">{column.title}</p>
              <ul className="mt-6 space-y-4 text-base text-[var(--landing-muted)] md:text-lg">
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

        <div className="mt-16 flex gap-8 text-sm text-[var(--landing-subtle)] md:text-base">
          <a href="#" className="transition hover:text-white">Privacy</a>
          <a href="#" className="transition hover:text-white">Terms</a>
          <a href="#" className="transition hover:text-white">DPA</a>
        </div>
      </div>
    </footer>
  );
}
