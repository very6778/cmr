import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Suspicious patterns to block (path traversal, system files, etc.)
const BLOCKED_PATTERNS = [
  /\/\.\./,           // Path traversal
  /\/dev\//,          // System device files
  /\/etc\//,          // System config files
  /\/proc\//,         // Process files
  /^\/\/+/,           // Multiple slashes
  /\0/,               // Null bytes
  /\\x[0-9a-f]{2}/i,  // Hex encoded chars
];

// Block known bad user agents (scanners, exploit tools)
const BAD_USER_AGENTS = [
  /nmap/i,
  /nikto/i,
  /sqlmap/i,
  /masscan/i,
  /zgrab/i,
];

function isBlockedRequest(req: Request): boolean {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const userAgent = req.headers.get("user-agent") || "";

  // Check for blocked path patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(pathname)) {
      console.warn(`Blocked suspicious path: ${pathname}`);
      return true;
    }
  }

  // Check for bad user agents
  for (const pattern of BAD_USER_AGENTS) {
    if (pattern.test(userAgent)) {
      console.warn(`Blocked bad user agent: ${userAgent}`);
      return true;
    }
  }

  return false;
}

export async function middleware(req: Request) {
  const secret = process.env.NEXTAUTH_SECRET;
  // @ts-ignore error-bypass
  const token = await getToken({ req, secret });

  const unprotectedRoutes = ["/api/auth", "/api/proxy"];
  const pathname = new URL(req.url).pathname;

  // Block suspicious requests BEFORE any processing (only for unauthenticated)
  if (!token && isBlockedRequest(req)) {
    return new NextResponse(
      JSON.stringify({ error: "Bad Request" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

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
