import { cn } from "@/lib/utils";

const links = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Company", href: "#company" },
  { label: "Blog", href: "#blog" },
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
