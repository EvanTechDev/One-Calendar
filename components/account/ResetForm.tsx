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
import { useState } from "react";

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
  const { signIn } = useSignIn();
  const router = useRouter();

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
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
                  />
                </div>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="code">Verification Code</Label>
                    <Input
                      id="code"
                      placeholder="123456"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
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
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="text-sm text-red-500">{error}</div>
              )}

              <Button type="submit" className="w-full bg-[#0066ff] hover:bg-[#0047cc] text-white" disabled={isLoading}>
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
        By continuing, you agree to our <a href="https://xyehr.cn/legal/terms-of-use">Terms of Service</a>{" "}
        and <a href="https://xyehr.cn/legal/privacy-policy">Privacy Policy</a>.
      </div>
    </div>
  );
}
