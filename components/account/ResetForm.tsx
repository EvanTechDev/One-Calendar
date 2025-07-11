"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { useState, useRef } from "react";
import { Turnstile } from "@marsidev/react-turnstile";

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState<"request" | "verify" | "success">("request");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? false : true
  );
  const turnstileRef = useRef<any>(null);
  const { signIn } = useSignIn();
  const router = useRouter();

  const handleTurnstileVerify = async (token: string) => {
    console.log("Turnstile token received:", token.slice(0, 10) + "...");
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "reset-password" }),
      });
      const data = await response.json();
      console.log("Verification API response:", JSON.stringify(data, null, 2));

      if (data.success) {
        setIsCaptchaVerified(true);
        setError("");
      } else {
        setIsCaptchaVerified(false);
        setError(`CAPTCHA verification failed: ${data.details?.join(", ") || "Unknown error"}`);
        if (turnstileRef.current) {
          turnstileRef.current.reset();
        }
      }
    } catch (err) {
      console.error("Error in handleTurnstileVerify:", err);
      setIsCaptchaVerified(false);
      setError("Error verifying CAPTCHA. Please try again.");
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
    }
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (siteKey && !isCaptchaVerified) {
      setError("Please complete the CAPTCHA verification.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await signIn?.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setStep("verify");
    } catch (err: any) {
      setError(err.errors[0].longMessage || "Failed to send verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (siteKey && !isCaptchaVerified) {
      setError("Please complete the CAPTCHA verification.");
      return;
    }
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn?.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password: newPassword,
      });

      if (result?.status === "complete") {
        setStep("success");
        setTimeout(() => router.push("/"), 2000);
      }
    } catch (err: any) {
      setError(err.errors[0].longMessage || "Password reset failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Password Updated</CardTitle>
            <CardDescription>
              Your password has been successfully reset
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => router.push("/sign-in")} className="w-full">
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {step === "request" ? "Reset Password" : "Enter Verification Code"}
          </CardTitle>
          <CardDescription>
            {step === "request"
              ? "Enter your email to receive a verification code"
              : `We sent a code to ${email}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={step === "request" ? handleRequestCode : handleResetPassword}>
            <div className="grid gap-6">
              {step === "request" ? (
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={siteKey && (!isCaptchaVerified || isLoading)}
                  />
                  {siteKey && (
                    <div className="turnstile-container">
                      <Turnstile
                        ref={turnstileRef}
                        siteKey={siteKey}
                        onSuccess={handleTurnstileVerify}
                        onError={() => {
                          console.error("Turnstile widget error");
                          setIsCaptchaVerified(false);
                          setError("CAPTCHA initialization failed. Please try again.");
                        }}
                        options={{
                          theme: "auto",
                          action: "reset-password",
                          cData: "reset-password-page",
                          refreshExpired: "auto",
                          size: "flexible",
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid gap-2">
                  <div className="grid gap-2">
                    <Label htmlFor="code">Verification Code</Label>
                    <Input
                      id="code"
                      placeholder="123456"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      disabled={siteKey && (!isCaptchaVerified || isLoading)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={siteKey && (!isCaptchaVerified || isLoading)}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="text-sm text-red-500">{error}</div>
              )}

              <Button
                type="submit"
                className="w-full bg-[#0066ff] hover:bg-[#0047cc] text-white"
                disabled={siteKey && (!isCaptchaVerified || isLoading)}
              >
                {isLoading
                  ? "Processing..."
                  : step === "request"
                  ? "Send Code"
                  : "Reset Password"}
              </Button>

              <div className="text-center text-sm">
                {step === "request" ? (
                  <>
                    Have an account?{" "}
                    <button
                      type="button"
                      onClick={() => router.push("/sign-in")}
                      className="underline underline-offset-4"
                    >
                      Login
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep("request")}
                    className="underline underline-offset-4"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
        By continuing, you agree to our <a href="/terms">Terms of Service</a>{" "}
        and <a href="/privacy">Privacy Policy</a>.
      </div>
    </div>
  );
}
