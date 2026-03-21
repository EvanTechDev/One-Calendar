"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const { isLoaded, signUp, setActive } = useSignUp();
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
  const [isCheckingBot, setIsCheckingBot] = useState(false);
  const [error, setError] = useState("");

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

  const verifyHuman = async (action: string) => {
    setIsCheckingBot(true);
    try {
      const response = await fetch("/api/botid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Bot verification failed. Please try again.");
      }
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Bot verification failed. Please try again.",
      );
      throw err;
    } finally {
      setIsCheckingBot(false);
    }
  };

  const handleOAuthSignUp = async (
    strategy: "oauth_google" | "oauth_microsoft" | "oauth_github",
  ) => {
    if (!isLoaded || !signUp) {
      setError("Auth service is still loading. Please try again in a moment.");
      return;
    }

    const redirect =
      signUp.authenticateWithRedirect ??
      (signUp as unknown as {
        authWithRedirect?: typeof signUp.authenticateWithRedirect;
      }).authWithRedirect;

    if (!redirect) {
      setError("OAuth is unavailable right now. Please refresh and try again.");
      return;
    }

    try {
      await verifyHuman(`sign-up:${strategy}`);
      redirect.call(signUp, {
        strategy,
        redirectUrl: "/sign-up/sso-callback",
        redirectUrlComplete: "/app",
      });
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (!isLoaded || !signUp) {
        setError("Auth service is still loading. Please try again in a moment.");
        return;
      }

      if (step === "initial") {
        await verifyHuman("sign-up");

        if (!isEmailDomainAllowed(formData.email)) {
          setError(
            "Email domain is not allowed. Please use a supported email provider.",
          );
          setIsLoading(false);
          return;
        }

        await signUp.create({
          firstName: formData.firstName,
          lastName: formData.lastName,
          emailAddress: formData.email,
          password: formData.password,
        });
        await signUp.prepareEmailAddressVerification();
        setStep("verification");
      } else {
        const completeSignUp = await signUp.attemptEmailAddressVerification({
          code: formData.code,
        });
        if (completeSignUp.status === "complete") {
          await setActive({ session: completeSignUp.createdSessionId });
          router.push("/app");
        }
      }
    } catch (err: any) {
      if (err?.errors) {
        setError(
          err.errors?.[0]?.longMessage ||
            "An error occurred. Please try again.",
        );
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
                        await signUp?.prepareEmailAddressVerification();
                      } catch {
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

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create an account</CardTitle>
          <CardDescription>
            Sign up to start managing all your calendars in one place
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={isLoading || isCheckingBot}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    disabled={isLoading || isCheckingBot}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <Button
                  variant="outline"
                  className="w-full"
                  type="button"
                  onClick={() => handleOAuthSignUp("oauth_microsoft")}
                  disabled={isLoading || isCheckingBot}
                >
                  Continue with Microsoft
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  type="button"
                  onClick={() => handleOAuthSignUp("oauth_google")}
                  disabled={isLoading || isCheckingBot}
                >
                  Continue with Google
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  type="button"
                  onClick={() => handleOAuthSignUp("oauth_github")}
                  disabled={isLoading || isCheckingBot}
                >
                  Continue with GitHub
                </Button>
              </div>
              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="relative z-10 bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
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
                  disabled={isLoading || isCheckingBot}
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
                  disabled={isLoading || isCheckingBot}
                />
              </div>
              {error && <div className="text-sm text-red-500">{error}</div>}
              <Button
                type="submit"
                className="w-full bg-[#0066ff] hover:bg-[#0047cc] text-white"
                disabled={isLoading || isCheckingBot}
              >
                {isLoading || isCheckingBot ? "Creating account..." : "Sign up"}
              </Button>
              <div className="text-center text-sm">
                Already have an account?{" "}
                <a href="/sign-in" className="underline underline-offset-4">
                  Sign in
                </a>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
