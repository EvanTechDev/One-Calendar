import { cn } from "@/lib/utils";

export const Logo = ({ className }: { className?: string }) => {
  return (
    <svg
      className={cn("text-foreground h-5 w-auto", className)}
      viewBox="0 0 108 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Kairo UI"
    >
      {/* Icon: bold K glyph inside a rounded square */}
      <rect
        x="0.75"
        y="0.75"
        width="26.5"
        height="26.5"
        rx="5.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 7.5v13M8 14l6.5-6.5M8 14l7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Wordmark: "kairo" */}
      {/* k */}
      <path
        d="M34 7v14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M34 14.5l5-5.5M34 14.5l5.5 6.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* a */}
      <path
        d="M47 12c-2.21 0-4 1.79-4 4s1.79 4 4 4h3.5v-4c0-2.21-1.79-4-4-4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M50.5 12v9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* i */}
      <line
        x1="56"
        y1="12"
        x2="56"
        y2="21"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="56" cy="9" r="1.1" fill="currentColor" />
      {/* r */}
      <path
        d="M61 12v9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M61 15c0-1.66 1.34-3 3-3h1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* o */}
      <circle
        cx="73"
        cy="16.5"
        r="4"
        stroke="currentColor"
        strokeWidth="1.75"
      />

      {/* Separator dot */}
      <circle cx="82" cy="20" r="1.2" fill="currentColor" opacity="0.4" />

      {/* "ui" suffix in muted weight */}
      {/* u */}
      <path
        d="M87 12v6c0 1.66 1.34 3 3 3s3-1.34 3-3v-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* i */}
      <line
        x1="97"
        y1="12"
        x2="97"
        y2="21"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.45"
      />
      <circle cx="97" cy="9" r="1.1" fill="currentColor" opacity="0.45" />
    </svg>
  );
};

export const LogoIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      className={cn("size-6", className)}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Kairo UI icon"
    >
      <rect
        x="0.75"
        y="0.75"
        width="26.5"
        height="26.5"
        rx="5.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 7.5v13M8 14l6.5-6.5M8 14l7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
