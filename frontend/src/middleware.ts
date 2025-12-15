import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: Request) {
  const secret = process.env.NEXTAUTH_SECRET;
  // @ts-ignore error-bypass
  const token = await getToken({ req, secret });

  const unprotectedRoutes = ["/api/auth"];
  const pathname = new URL(req.url).pathname;

  if (unprotectedRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*",
  ],
};
