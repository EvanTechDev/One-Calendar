"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FooterSection } from "@/components/landing/footer-section";
import { SiGithub } from "react-icons/si";

type LegalPageShellProps = {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: Array<{ heading: string; content: string[] }>;
  cta: string;
  github: string;
  home: string;
  allowHtml?: boolean;
};

function LegalNavigation() {
  return (
    <header className="fixed top-4 left-4 right-4 z-50">
      <nav className="mx-auto max-w-[1200px] rounded-2xl border border-foreground/10 bg-background/80 shadow-lg backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-6 lg:px-8">
          <Link href="/" className="font-display text-xl tracking-tight">
            One Calendar
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link href="/privacy" className="text-sm text-foreground/70 transition-colors hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="text-sm text-foreground/70 transition-colors hover:text-foreground">Terms</Link>
          </div>
          <div className="hidden items-center gap-4 md:flex">
            <Link href="/sign-in" className="text-xs text-foreground/70 transition-colors hover:text-foreground">Sign in</Link>
            <Button asChild size="sm" className="rounded-full bg-foreground px-4 text-xs text-background hover:bg-foreground/90">
              <Link href="/sign-up">Start free</Link>
            </Button>
          </div>
        </div>
      </nav>
    </header>
  );
}

export function LegalPageShell({
  title,
  lastUpdated,
  intro,
  sections,
  cta,
  github,
  home,
  allowHtml = false,
}: LegalPageShellProps) {
  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      <LegalNavigation />

      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-20 pt-32 lg:px-12">
        <div className="rounded-3xl border border-foreground/10 bg-background/60 p-8 shadow-2xl backdrop-blur-xl lg:p-12">
          <h1 className="mb-6 text-center font-display text-4xl tracking-tight lg:text-5xl">{title}</h1>
          <p className="mb-10 text-center text-sm text-muted-foreground">{lastUpdated}</p>
          <p className="mb-10 text-lg leading-relaxed text-foreground/85">{intro}</p>

          <div className="space-y-8">
            {sections.map((section, i) => (
              <article key={i} className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">{section.heading}</h2>
                {section.content.map((item, j) =>
                  allowHtml ? (
                    <p
                      key={j}
                      className="text-base leading-relaxed text-foreground/80"
                      dangerouslySetInnerHTML={{ __html: item }}
                    />
                  ) : (
                    <p key={j} className="text-base leading-relaxed text-foreground/80">
                      {item}
                    </p>
                  ),
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 pb-16 text-center lg:px-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-foreground/10 bg-background/40 p-8 backdrop-blur-xl">
          <h2 className="text-xl font-medium">{cta}</h2>
          <div className="pt-4 flex justify-center gap-5">
            <Link
              href="https://github.com/EvanTechDev/One-Calendar"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 text-sm text-foreground/80 transition-colors hover:text-foreground"
            >
              <SiGithub className="h-4 w-4" />
              {github}
            </Link>
            <Link href="/" className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
              {home}
            </Link>
          </div>
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
