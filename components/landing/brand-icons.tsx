interface IconProps {
  className?: string;
}

export const VercelIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 22.525H0L12 1.475Z" className="fill-zinc-900 dark:fill-white" />
  </svg>
);

export const SupabaseIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 109 113" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sb-g1" x1="66" y1="0" x2="32.5" y2="113" gradientUnits="userSpaceOnUse">
        <stop stopColor="#249361" />
        <stop offset="1" stopColor="#3ECF8E" />
      </linearGradient>
    </defs>
    <path d="M63.708 110.284C60.848 113.885 55.05 111.912 54.981 107.314L53.974 40.063H99.194C107.384 40.063 111.952 49.523 106.859 55.937L63.708 110.284Z" fill="url(#sb-g1)" />
    <path d="M45.317 2.071C48.177-1.53 53.975.443 54.044 5.041L54.485 72.292H9.831C1.64 72.292-2.928 62.832 2.166 56.417L45.317 2.071Z" fill="#3ECF8E" />
  </svg>
);

export const GitHubIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      className="fill-zinc-900 dark:fill-white"
      d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
    />
  </svg>
);

export const StripeIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="#635BFF"
      d="M13.479 9.883c-2.865-.692-3.796-1.24-3.796-2.181 0-1.009.933-1.655 2.438-1.655 1.868 0 3.622.77 4.845 1.923l1.885-2.796C17.283 3.908 15.28 3 12.573 3c-3.796 0-6.459 2.046-6.459 5.154 0 3.108 2.438 4.284 5.677 5.043 2.79.693 3.654 1.297 3.654 2.293 0 1.03-.968 1.648-2.561 1.648-2.014 0-4.012-.854-5.397-2.23L5.6 17.64C7.213 19.283 9.589 20.5 12.885 20.5c3.931 0 6.651-2.013 6.651-5.154.002-2.987-1.973-4.195-6.057-5.002v-.461z"
    />
  </svg>
);

export const OpenAIIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      className="fill-zinc-900 dark:fill-white"
      d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681v6.728zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"
    />
  </svg>
);

export const TursoIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4FF8D2" d="M13 2 4.5 13.5H11L10 22 19.5 10.5H13Z" />
  </svg>
);

export const DubIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="#3B82F6" d="M4 4h6c5.523 0 10 4.477 10 10S15.523 24 10 24H4V4zm4 4v12h2c3.314 0 6-2.686 6-6s-2.686-6-6-6H8z" />
  </svg>
);

export const ClaudeIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="#CC785C"
      d="M17.304 3.541 12.98 14.966h-1.894L6.697 3.541h2.045l3.26 9.202 3.258-9.202h2.044ZM4 20.459h2.045l.828-2.364h4.276l.826 2.364h2.046L9.976 9.132H7.98L4 20.459Zm3.415-4.048 1.584-4.521 1.583 4.521H7.415Z"
    />
  </svg>
);

export const NvidiaIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="#76B900"
      d="M9.5 3v2.513C6.1 5.913 3 9.1 3 12.5c0 3.6 3.1 6.587 6.5 7.187V22C5 21.4 1 17.4 1 12.5 1 7.6 5 3.6 9.5 3zm1.5 0c4.7.6 8.5 4.6 8.5 9.5 0 4.9-3.8 8.9-8.5 9.5v-2.5c3.9-.5 7-3.7 7-7 0-3.3-3.1-6.5-7-7V3zM9.5 8.5v4.5l4 2.5-1 1.5-5-3V8.5h2z"
    />
  </svg>
);

export const ClerkIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="8" r="4" fill="#6C47FF" />
    <path
      fill="#6C47FF"
      fillOpacity="0.6"
      d="M12 14c-5 0-8 2-8 4v1h16v-1c0-2-3-4-8-4z"
    />
    <path
      fill="#6C47FF"
      d="M18.5 10a1 1 0 0 1 .8.4l1.5 2-1.5 2a1 1 0 0 1-1.6-1.2l.7-.8-.7-.8a1 1 0 0 1 .8-1.6z"
    />
  </svg>
);

export const BoltIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="#FBBD23" d="M13 2 4.5 13.5H11L10 22 19.5 10.5H13Z" />
  </svg>
);

export const NotionIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      className="fill-zinc-900 dark:fill-white"
      d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.747 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.468.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854l-1.165-.327c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.28V8.62l-1.261-.14c-.094-.514.232-.98.697-1.027z"
    />
  </svg>
);

export const GmailIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M2 6.5A1.5 1.5 0 0 1 3.5 5h17A1.5 1.5 0 0 1 22 6.5V8l-10 6.5L2 8V6.5Z" />
    <path fill="#34A853" d="M22 8v9.5a1.5 1.5 0 0 1-1.5 1.5H14v-7l8-4Z" />
    <path fill="#FBBC05" d="M2 8v9.5A1.5 1.5 0 0 0 3.5 19H10v-7L2 8Z" />
    <path fill="#EA4335" d="M2 6.5 12 13l10-6.5A1.5 1.5 0 0 0 20.5 5h-17A1.5 1.5 0 0 0 2 6.5Z" />
  </svg>
);

export const CanvaIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#00C4CC" fillOpacity="0.15" />
    <path
      fill="#00C4CC"
      d="M12 2a10 10 0 1 0 7.32 16.906 1 1 0 1 0-1.463-1.364A8 8 0 1 1 12 4a1 1 0 0 0 0-2z"
    />
    <circle cx="12" cy="12" r="3.5" fill="#7D2AE7" />
  </svg>
);

export const AdobeIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="#FF0000"
      d="M14.43 13.832H9.57l-1.37 3.762H5.59l5.003-13.187h2.811l5.003 13.187h-2.609l-1.378-3.762Zm-4.069-2.214h3.278L12 6.937l-1.639 4.681Z"
    />
  </svg>
);

export const CursorIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="#0066FF" d="M5 3 19 12l-7.5 1.5L9 21Z" />
    <circle cx="18" cy="18" r="3.5" fill="#0066FF" fillOpacity="0.25" stroke="#0066FF" strokeWidth="1.5" />
    <path stroke="#0066FF" strokeWidth="1.5" strokeLinecap="round" d="M16.5 18h3M18 16.5v3" />
  </svg>
);

export const PlanetscaleIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      className="fill-zinc-900 dark:fill-white"
      d="M10.5 3.03 3.03 10.5a12.59 12.59 0 0 0 10.47 10.47l7.47-7.47A12.59 12.59 0 0 0 10.5 3.03zM5.4 10.4 10.4 5.4a10.59 10.59 0 0 1 8.2 8.2l-5 5a10.59 10.59 0 0 1-8.2-8.2z"
    />
    <path
      className="fill-zinc-900 dark:fill-white"
      d="M9 9h2v6H9zm4 0h2v6h-2z"
    />
  </svg>
);

export const PolarIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9.5" stroke="#3B82F6" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="4" fill="#3B82F6" fillOpacity="0.2" stroke="#3B82F6" strokeWidth="1.5" />
    <path stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" d="M12 2.5V7M12 17v4.5M2.5 12H7M17 12h4.5" />
  </svg>
);

export const FigmaIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="#F24E1E" d="M8 2h4a4 4 0 0 1 0 8H8V2z" />
    <path fill="#FF7262" d="M8 10h4a4 4 0 0 1 0 8H8v-8z" />
    <path fill="#A259FF" d="M8 18v4a4 4 0 0 0 4-4H8z" />
    <path fill="#1ABCFE" d="M16 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
    <path fill="#0ACF83" d="M4 6a4 4 0 0 1 4-4v8a4 4 0 0 1-4-4z" />
  </svg>
);
