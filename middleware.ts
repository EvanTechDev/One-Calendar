import { clerkMiddleware, redirectToSignIn, authMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export default clerkMiddleware((auth, req) => {
  const { userId } = auth()
  const url = req.nextUrl

  if (userId && ["/sign-in", "/sign-up"].includes(url.pathname)) {
    url.pathname = "/app"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}, {
  publicRoutes: [
    "/", "/sign-in", "/sign-up", "/app", "/about", "/privacy", "/terms",
    "/api/blob", "/api/blob/list", "/api/blob/cleanup", "/api/share",
  ],
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
