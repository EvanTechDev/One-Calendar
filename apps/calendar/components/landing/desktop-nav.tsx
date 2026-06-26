import { cn } from "@zntr/utils";

const links = [
  { label: "Code", href: "https://github.com/EvanTechDev/One-Calendar" },
  { label: "Changelog", href: "/changelog" },
  { label: "Contact", href: "mailto:evan.huang000@proton.me" },
];

export function DesktopNav() {
  return (
    <div className="hidden items-center gap-6 md:flex">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          className={cn(
            "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
            "active:scale-[0.97] transition-transform duration-[160ms] ease-[var(--ease-out)]"
          )}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
