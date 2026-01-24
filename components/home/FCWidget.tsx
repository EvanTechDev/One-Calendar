
"use client";

import { useEffect, useRef } from "react";

type Props = {
  sitekey: string;
  startMode?: "auto" | "focus" | "none";
  onSolved: (token: string) => void;
  onError?: () => void;
  onExpired?: () => void;
  onReset?: () => void;
};

export default function FriendlyCaptchaWidgetV2({
  sitekey,
  startMode = "auto",
  onSolved,
  onError,
  onExpired,
  onReset,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let destroyed = false;
    let widget: any;
    let el: HTMLElement | null = null;

    const run = async () => {
      if (!mountRef.current || !sitekey) return;

      const sdkMod = await import("@friendlycaptcha/sdk");
      const FriendlyCaptchaSDK = (sdkMod as any).FriendlyCaptchaSDK;
      const sdk = new FriendlyCaptchaSDK();

      widget = sdk.createWidget({
        element: mountRef.current,
        sitekey,
        startMode,
      });

      el = widget.getElement?.() ?? mountRef.current;

      const handleComplete = (e: any) => {
        if (destroyed) return;
        const token = e?.detail?.response || widget?.getResponse?.() || "";
        if (token) onSolved(token);
      };

      const handleError = () => {
        if (destroyed) return;
        onError?.();
      };

      const handleExpire = () => {
        if (destroyed) return;
        onExpired?.();
      };

      const handleReset = () => {
        if (destroyed) return;
        onReset?.();
      };

      el?.addEventListener("frc:widget.complete", handleComplete as EventListener);
      el?.addEventListener("frc:widget.error", handleError as EventListener);
      el?.addEventListener("frc:widget.expire", handleExpire as EventListener);
      el?.addEventListener("frc:widget.reset", handleReset as EventListener);

      return () => {
        el?.removeEventListener("frc:widget.complete", handleComplete as EventListener);
        el?.removeEventListener("frc:widget.error", handleError as EventListener);
        el?.removeEventListener("frc:widget.expire", handleExpire as EventListener);
        el?.removeEventListener("frc:widget.reset", handleReset as EventListener);
      };
    };

    let cleanup: any;
    run().then((c) => (cleanup = c));

    return () => {
      destroyed = true;
      try {
        cleanup?.();
      } catch {}
      try {
        widget?.destroy?.();
      } catch {}
    };
  }, [sitekey, startMode, onSolved, onError, onExpired, onReset]);

  if (!sitekey) return null;

  return <div ref={mountRef} />;
}
