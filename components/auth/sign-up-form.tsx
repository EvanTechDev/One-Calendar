"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import {
  getEnabledOAuthProviderKeys,
  OAUTH_PROVIDER_CONFIG,
  type OAuthStrategy,
} from "@/lib/clerk-oauth";
import { OAuthProviderIcon } from "@/components/auth/oauth-provider-icon";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const { signUp } = useSignUp();
  const router = useRouter();
  const [step, setStep] = useState<"initial" | "verification">("initial");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    code: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isCaptchaCompleted, setIsCaptchaCompleted] = useState(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? false : true,
  );
  const turnstileRef = useRef<any>(null);

  const handleTurnstileSuccess = async (token: string) => {
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "sign-up" }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error("Invalid JSON response from server");
      }

      if (data.success) {
        setIsCaptchaCompleted(true);
        setError("");
      } else {
        setIsCaptchaCompleted(false);
        setError(
          `CAPTCHA verification failed: ${data.details?.join(", ") || "Unknown error"}`,
        );
        if (turnstileRef.current) {
          turnstileRef.current.reset();
        }
      }
    } catch (err) {
      setIsCaptchaCompleted(false);
      setError("Error verifying CAPTCHA. Please try again.");
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
    }
  };

  const allowedEmailDomains = [
    "@qq.com",
    "@163.com",
    "@aliyun.com",
    "@dingtalk.com",
    "@email.cn",
    "@foxmail.com",
    "@gmail.com",
    "@gmx.com",
    "@gmx.de",
    "@hotmail.com",
    "@live.cn",
    "@live.com",
    "@mail.com",
    "@mail.retiehe.com",
    "@mail.ru",
    "@me.com",
    "@msn.cn",
    "@msn.com",
    "@my.com",
    "@net-c.com",
    "@outlook.com",
    "@outlook.jp",
    "@petalmail.com",
    "@retinbox.com",
    "@sina.cn",
    "@sina.com",
    "@sohu.com",
    "@tom.com",
    "@tutanota.com",
    "@vip.qq.com",
    "@vip.163.com",
    "@wo.cn",
    "@yahoo.co.jp",
    "@yahoo.com",
    "@yahoo.com.hk",
    "@yahoo.com.tw",
    "@yandex.com",
    "@yandex.ru",
    "@yeah.net",
    "@111.com",
    "@126.com",
    "@139.com",
    "@proton.me",
    "@pm.me",
    "@protonmail.com",
    "@protonmail.ch",
  ];

  const isEmailDomainAllowed = (email: string) => {
    return allowedEmailDomains.some((domain) =>
      email.toLowerCase().endsWith(domain),
    );
  };

  const handleOAuthSignUp = (strategy: OAuthStrategy) => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (siteKey && !isCaptchaCompleted) {
      setError("Please complete the CAPTCHA verification.");
      return;
    }
    signUp
      .sso({
        strategy,
        redirectUrl: "/app",
        redirectCallbackUrl: "/sign-up/sso-callback",
      })
      .catch((err: any) => {
        setError(err.errors?.[0]?.longMessage || "OAuth sign up failed. Please try again.");
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (siteKey && !isCaptchaCompleted) {
      setError("Please complete the CAPTCHA verification.");
      return;
    }
    setIsLoading(true);
    setError("");

    try {
      if (step === "initial") {
        if (!isEmailDomainAllowed(formData.email)) {
          setError(
            "Email domain is not allowed. Please use a supported email provider.",
          );
          setIsLoading(false);
          return;
        }

        const { error: passwordError } = await signUp.password({
          firstName: formData.firstName,
          lastName: formData.lastName,
          emailAddress: formData.email,
          password: formData.password,
        });
        if (passwordError) {
          setError(
            passwordError.longMessage || passwordError.message || "An error occurred. Please try again.",
          );
          return;
        }
        await signUp.verifications.sendEmailCode();
        setStep("verification");
      } else {
        const { error: verifyError } = await signUp.verifications.verifyEmailCode({
          code: formData.code,
        });
        if (verifyError) {
          setError(
            verifyError.longMessage || verifyError.message || "An error occurred. Please try again.",
          );
          return;
        }
        if (signUp.status === "complete") {
          const { error: finalizeError } = await signUp.finalize({
            navigate: ({ decorateUrl }) => {
              const url = decorateUrl("/app");
              if (url.startsWith("http")) {
                window.location.href = url;
                return;
              }
              router.push(url);
            },
          });
          if (finalizeError) {
            setError(
              finalizeError.longMessage || finalizeError.message || "An error occurred. Please try again.",
            );
          }
        }
      }
    } catch (err: any) {
      setError(
        err.errors?.[0]?.longMessage || "An error occurred. Please try again.",
      );
      if (siteKey && err.errors) {
        setIsCaptchaCompleted(false);
        if (turnstileRef.current) {
          turnstileRef.current.reset();
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (step === "verification") {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Verify Your Email</CardTitle>
            <CardDescription>
              We've sent a verification code to {formData.email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    name="code"
                    placeholder="123456"
                    required
                    value={formData.code}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
                {error && <div className="text-sm text-red-500">{error}</div>}
                <Button
                  type="submit"
                  className="w-full bg-[#0066ff] hover:bg-[#0047cc] text-white"
                  disabled={isLoading}
                >
                  {isLoading ? "Verifying..." : "Verify Email"}
                </Button>
                <div className="text-center text-sm">
                  Didn't receive a code?{" "}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await signUp.verifications.sendEmailCode();
                      } catch (err) {
                        setError("Failed to resend code. Please try again.");
                      }
                    }}
                    className="underline underline-offset-4 hover:text-primary"
                    disabled={isLoading}
                  >
                    Resend code
                  </button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const hasCaptcha = Boolean(siteKey);
  const enabledOAuthProviders = getEnabledOAuthProviderKeys();
  const hasOAuthProviders = enabledOAuthProviders.length > 0;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-6">
              {hasOAuthProviders && (
                <>
                  <div className="flex flex-col gap-4">
                    {enabledOAuthProviders.map((providerKey) => {
                      const provider = OAUTH_PROVIDER_CONFIG[providerKey];
                      return (
                        <Button
                          key={provider.strategy}
                          variant="outline"
                          className="w-full"
                          type="button"
                          onClick={() => handleOAuthSignUp(provider.strategy)}
                        >
                          <span className="flex items-center justify-center gap-2">
                            <OAuthProviderIcon providerKey={providerKey} />
                            <span>Continue with {provider.label}</span>
                          </span>
                        </Button>
                      );
                    })}
                  </div>

                  <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                    <span className="relative z-10 bg-background px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </>
              )}

              <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      placeholder="John"
                      required
                      value={formData.firstName}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      placeholder="Doe"
                      required
                      value={formData.lastName}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                  />
                  {hasCaptcha ? (
                    <div className="turnstile-container">
                      <Turnstile
                        ref={turnstileRef}
                        siteKey={siteKey!}
                        onSuccess={handleTurnstileSuccess}
                        onError={() => {
                          console.error("Turnstile widget error");
                          setIsCaptchaCompleted(false);
                          setError(
                            "CAPTCHA initialization failed. Please try again.",
                          );
                        }}
                        options={{
                          theme: "auto",
                          action: "sign-up",
                          cData: "sign-up-page",
                          refreshExpired: "auto",
                          size: "flexible",
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                {error && <div className="text-sm text-red-500">{error}</div>}

                <Button
                  type="submit"
                  className="w-full bg-[#0066ff] hover:bg-[#0047cc] text-white"
                  disabled={hasCaptcha ? !isCaptchaCompleted || isLoading : isLoading}
                >
                  {isLoading ? "Creating account..." : "Create account"}
                </Button>
              </div>

              <div className="text-center text-sm">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/sign-in")}
                  className="underline underline-offset-4"
                >
                  Sign in
                </button>
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
