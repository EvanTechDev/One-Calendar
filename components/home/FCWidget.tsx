
"use client";

import { useEffect, useId, useMemo } from "react";
import Script from "next/script";

declare global {
  interface Window {
    [key: string]: any;
  }
}

type Props = {
  sitekey: string;
  lang?: string;
  onSolved: (token: string) => void;
  onReset?: () => void;
};

export default function FriendlyCaptchaWidget({
  sitekey,
  lang = "en",
  onSolved,
  onReset,
}: Props) {
  const id = useId();
  const cbName = useMemo(() => `__fc_cb_${id.replace(/:/g, "_")}`, [id]);

  useEffect(() => {
    window[cbName] = (solution: string) => {
      onSolved(solution);
    };
    return () => {
      try {
        delete window[cbName];
      } catch {}
    };
  }, [cbName, onSolved]);

  if (!sitekey) return null;

  return (
    <div className="space-y-2">
      <Script
        type="module"
        src="https://cdn.jsdelivr.net/npm/friendly-challenge@0.9.18/widget.module.min.js"
        async
        defer
      />
      <Script
        noModule
        src="https://cdn.jsdelivr.net/npm/friendly-challenge@0.9.18/widget.min.js"
        async
        defer
      />
      <div
        className="frc-captcha"
        data-sitekey={sitekey}
        data-callback={cbName}
        data-lang={lang}
        data-start="auto"
      />
      {onReset ? (
        <button
          type="button"
          className="text-xs text-muted-foreground underline"
          onClick={onReset}
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}
