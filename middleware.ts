import { clerkMiddleware } from "@clerk/nextjs/server"

export default authMiddleware({
  publicRoutes: [
    "/",
    "/sign-in",
    "/sign-up",
    "/api/blob",
    "/api/blob/list",
    "/api/blob/cleanup",
    "/api/share",
  ],
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
