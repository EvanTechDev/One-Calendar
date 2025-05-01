import { clerkMiddleware } from "@clerk/nextjs/server"

export default clerkMiddleware({
  publicRoutes: [
    "/",
    "/app",
    "/sign-in",
    "/sign-up",
    "/reset-password",
    "/api/blob",
    "/api/blob/list",
    "/api/blob/cleanup",
    "/api/share",
    "/api/weather",
    "/api/chat",
    "/api/chat/schedule"
  ],
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
