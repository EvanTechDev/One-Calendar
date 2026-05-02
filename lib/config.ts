const FEEDBACK_EMAIL = 'evan.huang000@proton.me'
const STATUS_PAGE_URL = 'https://calendarstatus.xyehr.cn'
const GITHUB_URL = 'https://github.com/EvanTechDev/One-Calendar'

export const APP_CONFIG = {
  contact: {
    feedbackEmail: FEEDBACK_EMAIL,
    statusPageUrl: STATUS_PAGE_URL,
  },
  auth: {
    enabledOAuthProviders: [] as const,
    resend: {
      sender: process.env.RESEND_SENDER_EMAIL ?? 'no-reply@auth.example.com',
    },
  },
  landing: {
    footerSections: [
      {
        title: 'Product',
        links: [
          { label: 'Overview', href: '#features' },
          { label: 'Privacy', href: '/privacy' },
          { label: 'Terms', href: '/terms' },
        ],
      },
      {
        title: 'Resources',
        links: [
          {
            label: 'Documentation',
            href: 'https://docs.xyehr.cn/docs/one-calendar',
          },
          { label: 'Status', href: STATUS_PAGE_URL },
          { label: 'Support', href: `mailto:${FEEDBACK_EMAIL}` },
        ],
      },
      {
        title: 'Connect',
        links: [
          { label: 'Contact', href: `mailto:${FEEDBACK_EMAIL}` },
          {
            label: 'Bluesky',
            href: 'https://bsky.app/profile/calendar.xyehr.cn',
          },
          {
            label: 'Tangled',
            href: 'https://tangled.org/e.xyehr.cn/One-Calendar',
          },
          { label: 'GitHub', href: GITHUB_URL },
        ],
      },
    ],
  },
} as const
