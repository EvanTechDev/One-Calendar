import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@zntr/ui/accordion'

const faqs = [
  {
    value: 'what-is',
    question: 'What is One Calendar?',
    answer:
      'A privacy-first, weekly-focused open-source calendar built for clarity and control. It respects your privacy, provides a smooth local-first planning experience, and keeps the system understandable.',
  },
  {
    value: 'how-is-it-different',
    question: 'What makes One Calendar different?',
    answer:
      'Most modern calendar tools are overloaded with automation, notifications, and analytics. One Calendar takes a different approach: it respects user privacy, provides a smooth local-first planning experience, and keeps the system understandable. It is built for individuals and small teams who value clarity over complexity.',
  },
  {
    value: 'privacy',
    question: 'Is One Calendar really privacy-first?',
    answer:
      'Yes. There is no AI tracking, no behavioral profiling or data mining, and zero third-party tracking scripts by default. You get user-controlled exports for backup and portability without lock-in, and secure authentication via hardened session management with Better Auth.',
  },
  {
    value: 'features',
    question: 'What features does One Calendar offer?',
    answer:
      'Weekly planning with drag & drop scheduling, inline editing, and keyboard-friendly interactions. Event management with rich metadata, precise time control, optimistic UI for instant updates, and reliable persistence via Drizzle. Privacy & security features, cloud sync, theme configuration, locale-aware formatting, and internationalization (i18n).',
  },
  {
    value: 'open-source',
    question: 'Is One Calendar open-source?',
    answer:
      'Yes, it is completely open-source. You can self-host it with Drizzle ORM and PostgreSQL, giving you full control over your data.',
  },
]

export function FaqSection() {
  return (
    <section className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 md:px-8">
      <div className="space-y-2 text-center">
        <h2 className="font-medium text-lg text-muted-foreground tracking-tight md:text-xl">
          Frequently Asked <span className="text-foreground">Questions</span>
        </h2>
        <p className="text-muted-foreground text-sm max-w-[50ch] mx-auto leading-relaxed">
          Everything you need to know about One Calendar. Can&apos;t find what
          you&apos;re looking for? Check out the docs or contact us.
        </p>
      </div>
      <Accordion type="single" collapsible>
        {faqs.map((faq) => (
          <AccordionItem key={faq.value} value={faq.value}>
            <AccordionTrigger>{faq.question}</AccordionTrigger>
            <AccordionContent>{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
