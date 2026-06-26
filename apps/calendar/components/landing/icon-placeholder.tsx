import React from "react";
import * as LucideIcons from "lucide-react";

export interface IconPlaceholderProps extends React.SVGProps<SVGSVGElement> {
  lucide?: string;
  hugeicons?: string;
  phosphor?: string;
  remixicon?: string;
  tabler?: string;
  "data-icon"?: string;
}

export function IconPlaceholder({
  lucide,
  className,
  ...props
}: IconPlaceholderProps) {
  if (lucide) {
    const Icon = (LucideIcons as any)[lucide];
    if (Icon) {
      return <Icon className={className} {...props} />;
    }
  }

  // Fallback icon
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
