import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqItems = [
  {
    q: "What is One Calendar's product direction?",
    a: "One Calendar is positioned as a privacy-first, planning-focused open-source calendar built for clarity and control.",
  },
  {
    q: "Which import formats are supported?",
    a: "The project documents support for iCalendar (.ics), JSON, and CSV import/export workflows.",
  },
  {
    q: "Does One Calendar support encrypted data handling?",
    a: "Yes. The README lists optional end-to-end encryption (E2EE) support for privacy-sensitive usage.",
  },
  {
    q: "What stack powers cloud sync and auth?",
    a: "Cloud sync is described as optional and PostgreSQL-based, while authentication is handled through Clerk.",
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className="flex min-h-screen items-center border-b border-white/10 py-12">
      <div className="grid w-full gap-8 md:grid-cols-[240px_1fr]">
        <h2 className="landing-title-reveal text-3xl font-semibold text-white md:text-5xl">FAQ</h2>
        <div className="px-0 md:px-2">
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, idx) => (
              <AccordionItem key={item.q} value={`faq-${idx}`} className="border-white/10">
                <AccordionTrigger className="py-5 text-left text-base font-medium text-white hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm text-[var(--landing-muted)] md:text-base">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
