"use client";

import { cn } from "@/lib/utils";
import { type ElementType, type ReactNode, useEffect, useRef, useState } from "react";

type LandingTitleProps<T extends ElementType> = {
  as?: T;
  className?: string;
  children: ReactNode;
};

export function LandingTitle<T extends ElementType = "h2">({
  as,
  className,
  children,
}: LandingTitleProps<T>) {
  const Tag = (as ?? "h2") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.25, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={cn("landing-title", visible && "landing-title-visible", className)}>
      {children}
    </Tag>
  );
}
