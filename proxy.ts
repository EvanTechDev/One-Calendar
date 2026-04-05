import { clerkMiddleware } from "@clerk/nextjs/server"

export default clerkMiddleware({
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
  publicRoutes: [
    "/",
    "/app",
    "/sign-in",
    "/sign-up",
    "/reset-password",
    "/api/share",
    "/api/verify",
    "/at-oauth",
    "/api/atproto/(.*)",
    "/oauth-client-metadata.json",
    "/api/share/public"
  ],
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
