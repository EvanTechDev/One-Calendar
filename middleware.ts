import { clerkMiddleware, getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const customMiddleware = (request: NextRequest) => {
  const { userId } = getAuth(request);
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === "/sign-in" || pathname === "/sign-up";

  if (userId && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return clerkMiddleware()(request);
};

export default customMiddleware;

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
