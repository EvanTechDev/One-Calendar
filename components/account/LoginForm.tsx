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
import { useSignIn } from "@clerk/nextjs";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const { signIn, setActive } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isCaptchaCompleted, setIsCaptchaCompleted] = useState(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? false : true
  );
  const turnstileRef = useRef<any>(null);
  const router = useRouter();

  const handleTurnstileSuccess = async (token: string) => {
    console.log("Turnstile token received:", token.slice(0, 10) + "...");
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "login" }),
      });
      const data = await response.json();
      console.log("Verification API response:", JSON.stringify(data, null, 2));

      if (data.success) {
        setIsCaptchaCompleted(true);
        setError("");
      } else {
        setIsCaptchaCompleted(false);
        setError(`CAPTCHA verification failed: ${data.details?.join(", ") || "Unknown error"}`);
        if (turnstileRef.current) {
          turnstileRef.current.reset();
        }
      }
    } catch (err) {
      console.error("Error in handleTurnstileSuccess:", err);
      setIsCaptchaCompleted(false);
      setError("Error verifying CAPTCHA. Please try again.");
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (siteKey && !isCaptchaCompleted) {
      setError("Please complete the CAPTCHA verification.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || "Login failed. Please try again.");
      if (siteKey) {
        setIsCaptchaCompleted(false);
        if (turnstileRef.current) {
          turnstileRef.current.reset();
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = (strategy: "oauth_google" | "oauth_microsoft" | "oauth_github") => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (siteKey && !isCaptchaCompleted) {
      setError("Please complete the CAPTCHA verification.");
      return;
    }
    signIn.authenticateWithRedirect({
      strategy,
      redirectUrl: "/sign-in/sso-callback",
      redirectUrlComplete: "/",
    });
  };

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Login with your Microsoft, Google or GitHub account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailLogin}>
            <div className="grid gap-6">
              <div className="flex flex-col gap-4">
                <Button
                  variant="outline"
                  className="w-full"
                  type="button"
                  onClick={() => handleOAuthLogin("oauth_microsoft")}
                  disabled={siteKey && (!isCaptchaCompleted || isLoading)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23" width="20" height="20">
                    <path fill="#f25022" d="M1 1h10v10H1z"/>
                    <path fill="#00a4ef" d="M12 1h10v10H12z"/>
                    <path fill="#7fba00" d="M1 12h10v10H1z"/>
                    <path fill="#ffb900" d="M12 12h10v10H12z"/>
                  </svg>
                  <span className="ml-2">Login with Microsoft</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  type="button"
                  onClick={() => handleOAuthLogin("oauth_google")}
                  disabled={siteKey && (!isCaptchaCompleted || isLoading)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    <path d="M1 1h22v22H1z" fill="none"/>
                  </svg>
                  <span className="ml-2">Login with Google</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  type="button"
                  onClick={() => handleOAuthLogin("oauth_github")}
                  disabled={siteKey && (!isCaptchaCompleted || isLoading)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                    <path
                      d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="ml-2">Login with GitHub</span>
                </Button>
              </div>
              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="relative z-10 bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={siteKey && (!isCaptchaCompleted || isLoading)}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                    <a
                      href="/reset-password"
                      className="ml-auto text-sm underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </a>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={siteKey && (!isCaptchaCompleted || isLoading)}
                  />
                </div>
                {siteKey && (
                    <div className="turnstile-container">
                      <Turnstile
                        ref={turnstileRef}
                        siteKey={siteKey}
                        onSuccess={handleTurnstileSuccess}
                        onError={() => {
                          console.error("Turnstile widget error");
                          setIsCaptchaCompleted(false);
                          setError("CAPTCHA initialization failed. Please try again.");
                        }}
                        options={{ theme: "auto", action: "login", cData: "login-page", refreshExpired: "auto", size: "flexible" }}
                      />
                    </div>
                  )}
                {error && (
                  <div className="text-sm text-red-500">{error}</div>
                )}
                <Button
                  type="submit"
                  className="w-full bg-[#0066ff] hover:bg-[#0047cc] text-white"
                  disabled={siteKey && (!isCaptchaCompleted || isLoading)}
                >
                  {isLoading ? "Signing in..." : "Login"}
                </Button>
              </div>
              <div className="text-center text-sm">
                Don't have an account?{" "}
                <a href="/sign-up" className="underline underline-offset-4">
                  Sign up
                </a>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
        By clicking continue, you agree to our <a href="/terms">Terms of Service</a>{" "}
        and <a href="/privacy">Privacy Policy</a>.
      </div>
    </div>
  );
}
