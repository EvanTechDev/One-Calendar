import { clerkMiddleware } from "@clerk/nextjs/server"

export default clerkMiddleware({
  publicRoutes: [
    "/",
    "/app",
    "/sign-in",
    "/sign-up",
    "/reset-password",
    "/api/blob",
    "/api/share",
    "/api/verify",
    "/atproto",
    "/api/atproto/(.*)",
    "/oauth-client-metadata.json",
    "/api/share/public"
  ],
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
