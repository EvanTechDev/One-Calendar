"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type React from "react";

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const { signIn } = useSignIn();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [formData, setFormData] = useState({
    email: "",
    code: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingBot, setIsCheckingBot] = useState(false);
  const [error, setError] = useState("");

  const verifyHuman = async () => {
    setIsCheckingBot(true);
    try {
      const response = await fetch("/api/botid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-password" }),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (step === "email") {
        await verifyHuman();
        await signIn?.create({
          strategy: "reset_password_email_code",
          identifier: formData.email,
        });
        setStep("code");
      } else if (step === "code") {
        const result = await signIn?.attemptFirstFactor({
          strategy: "reset_password_email_code",
          code: formData.code,
        });
        if (result?.status === "needs_new_password") {
          setStep("password");
        }
      } else {
        const result = await signIn?.resetPassword({
          password: formData.password,
        });
        if (result?.status === "complete") {
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

  const getStepContent = () => {
    switch (step) {
      case "email":
        return {
          title: "Reset your password",
          description:
            "Enter your email address and we'll send you a verification code",
          fields: (
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
          ),
          buttonText: "Send verification code",
        };
      case "code":
        return {
          title: "Enter verification code",
          description: `We've sent a verification code to ${formData.email}`,
          fields: (
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
          ),
          buttonText: "Verify code",
        };
      case "password":
        return {
          title: "Set new password",
          description: "Enter your new password",
          fields: (
            <div className="grid gap-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
          ),
          buttonText: "Reset password",
        };
    }
  };

  const stepContent = getStepContent();

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{stepContent.title}</CardTitle>
          <CardDescription>{stepContent.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-6">
              {stepContent.fields}

              {error && <div className="text-sm text-red-500">{error}</div>}

              <Button
                type="submit"
                className="w-full bg-[#0066ff] hover:bg-[#0047cc] text-white"
                disabled={isLoading || (step === "email" && isCheckingBot)}
              >
                {isLoading || (step === "email" && isCheckingBot)
                  ? "Processing..."
                  : stepContent.buttonText}
              </Button>

              <div className="text-center text-sm">
                Remember your password?{" "}
                <a
                  href="/sign-in"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Sign in
                </a>
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
