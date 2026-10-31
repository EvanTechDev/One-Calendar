import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@zntr/ui/accordion'

const faqs = [
  {
    value: 'what-is',
    question: 'What is Zentra Calendar?',
    answer:
      'The next gen calendar powered by AI agent. Connect an agent over MCP to plan your week, create and move events, and set reminders in conversation, while the calendar itself stays fast, keyboard-driven, and understandable.',
  },
  {
    value: 'how-is-it-different',
    question: 'What makes Zentra Calendar different?',
    answer:
      'Most calendar tools bolt AI onto a closed platform. Zentra Calendar is open source and agent-native: your AI connects through MCP with scoped keys you control, and everything it can do, you can audit. Built for individuals and small teams who want automation without losing clarity.',
  },
  {
    value: 'agent',
    question: 'How does the AI agent work?',
    answer:
      'Zentra Calendar ships an MCP (Model Context Protocol) server. Connect Claude, Cursor, or any MCP client with a scoped API key or OAuth, and your agent can read your schedule, create and reschedule events, and manage reminders. You grant scopes per key and can revoke access at any time.',
  },
  {
    value: 'features',
    question: 'What features does Zentra Calendar offer?',
    answer:
      'Drag and drop weekly planning, inline editing, and keyboard-first interactions. Recurring events with per-occurrence edit scopes, email invitations with RSVP, in-app and email reminders, ICS import and export, cloud sync, 34 languages, and light and dark themes.',
  },
  {
    value: 'open-source',
    question: 'Is Zentra Calendar open-source?',
    answer:
      'Yes, completely. You can self-host the whole stack with PostgreSQL and Drizzle ORM, giving you full control over your data and your agent integrations.',
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
          Everything you need to know about Zentra Calendar. Can&apos;t find
          what you&apos;re looking for? Check out the docs or contact us.
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
