import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LandingTitle } from "./title";

const faqItems = [
  {
    q: "What is One Calendar’s core product focus?",
    a: "One Calendar is an open-source, privacy-first calendar focused on planning clarity, fast interaction, and long-term data control.",
  },
  {
    q: "Which import/export formats are supported?",
    a: "The product supports iCalendar (.ics), JSON, and CSV import/export workflows for easier migration and backup.",
  },
  {
    q: "Does it support end-to-end encryption?",
    a: "Yes. End-to-end encryption (E2EE) is available as an optional capability for privacy-sensitive schedules.",
  },
  {
    q: "What powers cloud sync and authentication?",
    a: "Cloud sync is optional and PostgreSQL-based, while authentication is handled through Clerk.",
  },
  {
    q: "Can I move my data away from One Calendar?",
    a: "Yes. Portability is a key principle, so your data can be exported and moved across tools without lock-in.",
  },
  {
    q: "Is it suitable for team workflows?",
    a: "Yes. It works well for release planning, recurring team meetings, milestone tracking, and cross-time-zone coordination.",
  },
  {
    q: "How is the mobile experience?",
    a: "The landing and core interfaces are responsive. Mobile prioritizes quick access, while desktop emphasizes editing speed.",
  },
  {
    q: "Are keyboard shortcuts and fast editing supported?",
    a: "Yes. One Calendar is designed for high-frequency operation with keyboard shortcuts and low-friction edits.",
  },
  {
    q: "Is the project open-source and self-hostable?",
    a: "Yes. The codebase is open-source and can be reviewed, deployed, and extended according to your needs.",
  },
  {
    q: "Is it a good fit for individual users?",
    a: "Absolutely. It works for study plans, health routines, family schedules, travel planning, and personal project timelines.",
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className="border-b border-white/10 py-24 md:py-28">
      <div className="grid w-full gap-8 md:grid-cols-[300px_1fr]">
        <LandingTitle as="h2" className="text-3xl font-semibold text-white md:text-5xl">FAQ</LandingTitle>
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
