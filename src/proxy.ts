import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function proxy(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    const isAuthPage = 
      req.nextUrl.pathname === "/" || 
      req.nextUrl.pathname === "/register" ||
      req.nextUrl.pathname === "/forgot-password";

    if (isAuthPage) {
      if (isAuth) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return null;
    }

    if (!isAuth) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => true, // Let the middleware function handle the logic
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/manage/:path*",
    "/",
    "/register",
    "/forgot-password",
  ],
};
