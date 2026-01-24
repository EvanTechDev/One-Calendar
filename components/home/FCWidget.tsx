"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

type Props = {
  sitekey: string;
  startMode?: "auto" | "focus" | "none";
  onSolved: (token: string) => void;
  onError?: () => void;
  onExpired?: () => void;
  onReset?: () => void;
};

export type FriendlyCaptchaRef = {
  reset: () => void;
};

const FriendlyCaptchaWidgetV2 = forwardRef<FriendlyCaptchaRef, Props>(
  ({ sitekey, startMode = "auto", onSolved, onError, onExpired, onReset }, ref) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const widgetRef = useRef<any>(null);
    const callbacksRef = useRef({ onSolved, onError, onExpired, onReset });
    callbacksRef.current = { onSolved, onError, onExpired, onReset };

    useImperativeHandle(ref, () => ({
      reset: () => {
        widgetRef.current?.reset?.();
      },
    }));

    useEffect(() => {
      if (!mountRef.current || !sitekey) return;

      let destroyed = false;
      let el: HTMLElement | null = null;

      const run = async () => {
        const sdkMod = await import("@friendlycaptcha/sdk");
        const FriendlyCaptchaSDK = (sdkMod as any).FriendlyCaptchaSDK;
        const sdk = new FriendlyCaptchaSDK();

        widgetRef.current = sdk.createWidget({
          element: mountRef.current!,
          sitekey,
          startMode,
        });

        el = widgetRef.current.getElement?.() ?? mountRef.current;

        const handleComplete = (e: any) => {
          if (destroyed) return;
          const token = e?.detail?.response || widgetRef.current?.getResponse?.() || "";
          if (token) callbacksRef.current.onSolved(token);
        };

        const handleError = () => {
          if (destroyed) return;
          callbacksRef.current.onError?.();
        };

        const handleExpire = () => {
          if (destroyed) return;
          callbacksRef.current.onExpired?.();
        };

        const handleReset = () => {
          if (destroyed) return;
          callbacksRef.current.onReset?.();
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
        try { cleanup?.(); } catch {}
        try { widgetRef.current?.destroy?.(); } catch {}
        widgetRef.current = null;
        el = null;
      };
    }, [sitekey, startMode]);

    if (!sitekey) return null;

    return <div ref={mountRef} />;
  }
);

export default FriendlyCaptchaWidgetV2;
