import Link from 'next/link'
import { Button } from '@zntr/ui/button'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  Code2,
  Command,
  FileText,
  Layers,
  Plug,
  Repeat2,
  Sparkles,
  Timer,
  Users,
} from 'lucide-react'
import { LandingCalendarPreview } from './landing-calendar-preview'
import { LANDING_DOCS_URL, LANDING_REPOSITORY_URL } from './landing-navigation'

// Claims follow docs/content/docs/calendar and integrations/mcp.mdx.
// Example events are labeled separately; they are not product/customer claims.
export function LandingHero() {
  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero-copy">
        <a className="landing-announcement" href={LANDING_REPOSITORY_URL}>
          <Code2 aria-hidden="true" />
          An open-source calendar
          <ArrowUpRight aria-hidden="true" />
        </a>
        <h1 id="landing-title">
          Plan the day.
          <br />
          <span>See the whole year.</span>
        </h1>
        <div className="landing-hero-bottom">
          <p>
            Recurring plans, invitations, and reminders. See your events by day,
            week, month, or year — and organize them your way.
          </p>
          <div className="landing-actions">
            <Button asChild size="sm">
              <Link href="/sign-up">
                Create account <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <a href="#calendar">
                Take a look <ArrowDown aria-hidden="true" />
              </a>
            </Button>
          </div>
        </div>
      </div>
      <div className="landing-product" id="calendar">
        <LandingCalendarPreview />
      </div>
      <div className="landing-facts">
        <div>
          <Layers aria-hidden="true" />
          <span>Five calendar views</span>
          <p>From a single day to the whole year</p>
        </div>
        <div>
          <Repeat2 aria-hidden="true" />
          <span>Recurring events</span>
          <p>Single dates or repeating plans</p>
        </div>
        <div>
          <Plug aria-hidden="true" />
          <span>MCP access</span>
          <p>Permissions you can revoke</p>
        </div>
      </div>
    </section>
  )
}

const features = [
  {
    icon: Layers,
    label: 'Categories',
    title: 'Choose what’s in view.',
    description:
      'Group events into categories and filter the calendar. Hiding a category changes the view, not the events.',
    href: 'categories',
    details: ['Group events', 'Filter categories'],
  },
  {
    icon: Repeat2,
    label: 'Recurring events',
    title: 'Change a date. Keep the pattern.',
    description:
      'Repeat daily, weekly, monthly, or yearly. Edit one occurrence or change this and following events.',
    href: 'recurring-events',
    details: ['This event', 'This and following events'],
  },
  {
    icon: Users,
    label: 'Invitations',
    title: 'Send the invite. See the response.',
    description:
      'Invite participants by email and track their replies. For recurring events, choose which dates to share.',
    href: 'invitations',
    details: ['Accepted', 'Tentative', 'Declined'],
  },
  {
    icon: Bell,
    label: 'Reminders',
    title: 'Decide when to be reminded.',
    description:
      'Choose a lead time and browser or email reminders. Browser reminders need Calendar open; email has a daily limit.',
    href: 'reminders',
    details: ['Browser notifications', 'Email reminders'],
  },
]

export function LandingFeatures() {
  return (
    <section
      className="landing-section"
      id="features"
      aria-labelledby="features-title"
    >
      <div className="landing-section-heading">
        <div>
          <p className="landing-eyebrow">Everyday planning</p>
          <h2 id="features-title">A place for the details.</h2>
        </div>
        <p>Organize the events. Set the pattern. Bring the right people.</p>
      </div>
      <div className="landing-feature-grid">
        {features.map((feature) => (
          <article className="landing-feature" key={feature.label}>
            <div className="landing-feature-label">
              <feature.icon aria-hidden="true" />
              {feature.label}
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
            <div
              className="landing-feature-tags"
              aria-label={`${feature.label} options`}
            >
              {feature.details.map((detail) => (
                <span key={detail}>{detail}</span>
              ))}
            </div>
            <a
              className="landing-text-link"
              href={`${LANDING_DOCS_URL}/calendar/${feature.href}`}
            >
              Read about {feature.label.toLowerCase()}{' '}
              <ArrowUpRight aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}

export function LandingAutomation() {
  return (
    <section
      className="landing-section landing-automation"
      id="integrations"
      aria-labelledby="automation-title"
    >
      <div className="landing-section-heading">
        <div>
          <p className="landing-eyebrow">AI & integrations</p>
          <h2 id="automation-title">Another way into your calendar.</h2>
        </div>
        <p>
          Start with words, or connect an assistant you already use. The
          calendar stays at the center.
        </p>
      </div>
      <div className="landing-automation-grid">
        <article className="landing-automation-card">
          <div
            className="landing-assistant-visual"
            aria-label="The command palette provides search and AI commands"
          >
            <div className="landing-command-surface">
              <div>
                <Command aria-hidden="true" />
                <span>Calendar commands</span>
                <kbd>⌘ K</kbd>
              </div>
              <span>
                <Sparkles aria-hidden="true" /> Ask AI
              </span>
              <div className="landing-command-options">
                <span>Find events</span>
                <span>Create</span>
                <span>Reschedule</span>
              </div>
            </div>
          </div>
          <h3>Start with a sentence.</h3>
          <p>
            Fill a new event draft from its title, or open the command palette
            to ask AI to read, create, and reschedule events.
          </p>
          <p className="landing-command-key">
            Open the command palette with <kbd>⌘ / Ctrl + K</kbd>.
          </p>
          <ul className="landing-check-list">
            <li>
              <Check aria-hidden="true" />
              Review a parsed draft before saving
            </li>
            <li>
              <Check aria-hidden="true" />
              Confirm destructive assistant actions
            </li>
          </ul>
          <p className="landing-availability">
            AI features require an AI-enabled deployment.
          </p>
          <a
            className="landing-text-link"
            href={`${LANDING_DOCS_URL}/calendar/ai`}
          >
            How AI works <ArrowUpRight aria-hidden="true" />
          </a>
        </article>
        <article className="landing-automation-card">
          <div className="landing-connection-visual">
            <div
              className="landing-mcp-diagram"
              aria-label="MCP connects an authorized AI client to Zentra Calendar"
            >
              <span>
                <Command aria-hidden="true" />
                AI client
              </span>
              <span className="landing-mcp-line" aria-hidden="true" />
              <span className="landing-mcp-node">
                <Plug aria-hidden="true" />
                MCP
              </span>
              <span className="landing-mcp-line" aria-hidden="true" />
              <span>
                <img src="/logo-light.svg" alt="" width={24} height={24} />
                Calendar
              </span>
            </div>
            <span className="landing-access-label">
              <Check aria-hidden="true" /> Access you choose. Access you can
              revoke.
            </span>
          </div>
          <h3>Connect your own assistant.</h3>
          <p>
            Authorize an MCP client with OAuth or an API key. Grant access by
            resource, inspect its activity, and revoke it when you’re done.
          </p>
          <div className="landing-scope-list">
            <span>Events</span>
            <span>Categories</span>
            <span>Bookmarks</span>
            <span>Countdowns</span>
            <span>Settings</span>
            <span>Profile · read only</span>
          </div>
          <a
            className="landing-text-link"
            href={`${LANDING_DOCS_URL}/integrations/mcp`}
          >
            Read the MCP guide <ArrowUpRight aria-hidden="true" />
          </a>
        </article>
      </div>
    </section>
  )
}

const tools = [
  {
    icon: Bookmark,
    title: 'Keep events close.',
    description:
      'Bookmark an event to return to its details without finding the date again.',
    label: 'Bookmarks',
    href: 'bookmarks',
  },
  {
    icon: Timer,
    title: 'Count down to a date.',
    description:
      'Track days to a milestone. Countdowns stay separate from scheduled events.',
    label: 'Countdowns',
    href: 'countdowns',
  },
  {
    icon: ArrowDownToLine,
    title: 'Move your event data.',
    description:
      'Import and export ICS, JSON, or CSV. Link imports are one-time reads, not two-way sync.',
    label: 'Import & export',
    href: 'import-export',
  },
]

export function LandingTools() {
  return (
    <section
      className="landing-section landing-tools"
      aria-labelledby="tools-title"
    >
      <div className="landing-section-heading">
        <div>
          <p className="landing-eyebrow">Alongside your events</p>
          <h2 id="tools-title">The dates worth keeping close.</h2>
        </div>
        <p>
          Return to an event, count down to a milestone, or bring your existing
          calendar data.
        </p>
      </div>
      <div className="landing-tools-grid">
        {tools.map((tool) => (
          <article key={tool.label}>
            <tool.icon className="landing-tool-icon" aria-hidden="true" />
            <h3>{tool.title}</h3>
            <p>{tool.description}</p>
            <a
              className="landing-text-link"
              href={`${LANDING_DOCS_URL}/calendar/${tool.href}`}
            >
              {tool.label} <ArrowUpRight aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
      <div className="landing-source-banner">
        <Code2 aria-hidden="true" />
        <div>
          <h3>The source is part of the product.</h3>
          <p>Zentra Calendar is open source under the MIT License.</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={LANDING_REPOSITORY_URL}>
            View on GitHub <ArrowUpRight aria-hidden="true" />
          </a>
        </Button>
      </div>
    </section>
  )
}

const faqs = [
  {
    question: 'Which calendar views are available?',
    answer:
      'Day, four days, week, month, and year. You can set a default view, choose the first day of the week, and use 12-hour or 24-hour time.',
  },
  {
    question: 'Do I need AI to use Calendar?',
    answer:
      'No. The event editor, calendar views, and ordinary keyword search work without AI. Natural-language event filling and the built-in assistant are available when AI is enabled for the deployment.',
  },
  {
    question: 'Does importing a calendar keep it in sync?',
    answer:
      'No. Importing a file or URL reads events once. Later changes at the source do not automatically update Zentra, and edits in Zentra do not write back to the source. ICS, JSON, and CSV import and export are supported.',
  },
  {
    question: 'Will reminders work when the page is closed?',
    answer:
      'Browser reminders need Calendar running and notification permission. Use email reminders when the page will be closed. You can schedule up to five reminder emails per day, counted on their sending date in your time zone.',
  },
  {
    question: 'What can a connected AI client access?',
    answer:
      'An MCP client can access the resources allowed by its OAuth grant or API key. Events, categories, bookmarks, countdowns, and settings have separate read and write permissions; profile access is read-only. You can revoke access or disable MCP in settings.',
  },
]

export function LandingFaq() {
  return (
    <section
      className="landing-faq landing-section"
      id="questions"
      aria-labelledby="faq-title"
    >
      <div>
        <p className="landing-eyebrow">Questions & answers</p>
        <h2 id="faq-title">A few things to know.</h2>
        <a className="landing-text-link" href={LANDING_DOCS_URL}>
          Read the documentation <ArrowUpRight aria-hidden="true" />
        </a>
      </div>
      <div className="landing-faq-list">
        {faqs.map((faq) => (
          <details key={faq.question}>
            <summary>
              {faq.question}
              <ChevronDown aria-hidden="true" />
            </summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function LandingCallToAction() {
  return (
    <section className="landing-final-cta" aria-labelledby="cta-title">
      <div className="landing-cta-mark" aria-hidden="true">
        <img src="/logo-light.svg" alt="" width={48} height={48} />
      </div>
      <h2 id="cta-title">
        Your next event
        <br />
        <span>starts here.</span>
      </h2>
      <div className="landing-actions">
        <Button asChild size="sm">
          <Link href="/sign-up">
            Create account <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
      <a className="landing-text-link" href={LANDING_DOCS_URL}>
        <FileText aria-hidden="true" />
        Or read the docs first <ArrowUpRight aria-hidden="true" />
      </a>
    </section>
  )
}
