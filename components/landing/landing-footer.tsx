const footerColumns = [
  { title: "Product", links: ["Overview", "Integrations", "Updates"] },
  { title: "Company", links: ["About", "Careers", "Contact"] },
  { title: "Resources", links: ["Help center", "API", "Status"] },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-white/10 px-6 py-14 text-[var(--landing-subtle)] md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <p className="text-base font-semibold text-white">One Calendar</p>
            <p className="mt-3 max-w-xs text-sm">Minimal scheduling, maximum clarity.</p>
          </div>
          {footerColumns.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-medium text-white">{column.title}</p>
              <ul className="mt-4 space-y-3 text-sm">
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
        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs md:flex-row md:justify-between">
          <div className="flex gap-4">
            <a href="#" className="transition hover:text-white">Privacy</a>
            <a href="#" className="transition hover:text-white">Terms</a>
          </div>
          <p>© {new Date().getFullYear()} One Calendar. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
