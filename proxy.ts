import { clerkMiddleware } from "@clerk/nextjs/server"

export default clerkMiddleware({
  publicRoutes: [
    "/",
    "/app",
    "/sign-in",
    "/sign-up",
    "/reset-password",
    "/atproto",
    "/api/blob",
    "/api/share",
    "/api/verify",
    "/api/atproto(.*)",
    "/:handle/:id"
  ],
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
