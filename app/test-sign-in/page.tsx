"use client"

import { SignIn } from "@clerk/nextjs"
import { Card, CardContent } from "@/components/ui/card"

export default function SignInPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardContent className="p-6">
          <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
        </CardContent>
      </Card>
    </div>
  )
}
