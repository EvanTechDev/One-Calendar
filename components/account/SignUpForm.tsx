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
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const { signUp, setActive } = useSignUp();
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

  const allowedEmailDomains = [
    "@qq.com", "@163.com", "@aliyun.com", "@dingtalk.com", "@email.cn", "@foxmail.com",
    "@gmail.com", "@gmx.com", "@gmx.de", "@hotmail.com", "@live.cn", "@live.com", "@mail.com",
    "@mail.retiehe.com", "@mail.ru", "@me.com", "@msn.cn", "@msn.com", "@my.com", "@net-c.com",
    "@outlook.com", "@outlook.jp", "@petalmail.com", "@retinbox.com", "@sina.cn", "@sina.com",
    "@sohu.com", "@tom.com", "@tutanota.com", "@vip.qq.com", "@vip.163.com", "@wo.cn",
    "@yahoo.co.jp", "@yahoo.com", "@yahoo.com.hk", "@yahoo.com.tw", "@yandex.com", "@yandex.ru",
    "@yeah.net", "@111.com", "@126.com", "@139.com", "@proton.me", "@pm.me",
    "@protonmail.com", "@protonmail.ch"
  ];

  const isEmailDomainAllowed = (email: string) => {
    return allowedEmailDomains.some(domain => email.endsWith(domain));
  };

  const handleOAuthSignUp = (strategy: "oauth_google" | "oauth_microsoft" | "oauth_github") => {
    signUp.authenticateWithRedirect({
      strategy,
      redirectUrl: "/sign-up/sso-callback",
      redirectUrlComplete: "/",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (step === "initial") {
        if (!isEmailDomainAllowed(formData.email)) {
          setError("Email domain is not allowed. Please use a supported email provider.");
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
          router.push("/");
        }
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || "An error occurred. Please try again.");
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
                  />
                </div>
                {error && <div className="text-sm text-red-500">{error}</div>}
                <Button type="submit" className="w-full bg-[#0066ff] hover:bg-[#0047cc]" disabled={isLoading}>
                  {isLoading ? "Verifying..." : "Verify Email"}
                </Button>
                <div className="text-center text-sm">
                  Didn't receive a code?{" "}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await signUp?.prepareEmailAddressVerification();
                      } catch (err) {
                        setError("Failed to resend code. Please try again.");
                      }
                    }}
                    className="underline underline-offset-4 hover:text-primary"
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
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Continue with Microsoft, Google, GitHub account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-6">
              <div className="flex flex-col gap-4">
                <Button variant="outline" className="w-full" type="button" onClick={() => handleOAuthSignUp("oauth_microsoft")}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23" width="20" height="20">
                    <path fill="#f25022" d="M1 1h10v10H1z" />
                    <path fill="#00a4ef" d="M12 1h10v10H12z" />
                    <path fill="#7fba00" d="M1 12h10v10H1z" />
                    <path fill="#ffb900" d="M12 12h10v10H12z" />
                  </svg>
                  <span className="ml-2">Continue with Microsoft</span>
                </Button>
                <Button variant="outline" className="w-full" type="button" onClick={() => handleOAuthSignUp("oauth_google")}>
                  {/* Google icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    <path d="M1 1h22v22H1z" fill="none" />
                  </svg>
                  <span className="ml-2">Continue with Google</span>
                </Button>
                <Button variant="outline" className="w-full" type="button" onClick={() => handleOAuthSignUp("oauth_github")}>
                  {/* GitHub icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                    <path
                      d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 
                      0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61
                      C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729
                      1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998
                      .108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93
                      0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176
                      0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405
                      1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23
                      .645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22
                      0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22
                      0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57
                      C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="ml-2">Continue with GitHub</span>
                </Button>
              </div>

              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="relative z-10 bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>

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
                </div>

                {error && <div className="text-sm text-red-500">{error}</div>}

                <Button type="submit" className="w-full bg-[#0066ff] hover:bg-[#0047cc] text-white" disabled={isLoading}>
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
        By continuing, you agree to our{" "}
        <a href="https://xyehr.cn/legal/terms-of-use">Terms of Service</a> and{" "}
        <a href="https://xyehr.cn/legal/privacy-policy">Privacy Policy</a>.
      </div>
    </div>
  );
}
