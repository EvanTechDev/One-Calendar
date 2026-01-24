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
    "/api/verify"
  ],
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
