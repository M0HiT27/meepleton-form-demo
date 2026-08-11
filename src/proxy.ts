// proxy.ts
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
  process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001',
];

const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  // /^https:\/\/([a-z0-9-]+\.)*example\.com$/i,
];

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

function applyCorsHeaders(res: NextResponse, origin: string) {
  const allowed = isOriginAllowed(origin);
  if (allowed) res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Vary', 'Origin');
  return res;
}

export default function proxy(request: NextRequest) {
  const origin = request.headers.get('origin') ?? '';
  const { pathname } = request.nextUrl;

  // Handle preflight for ALL /api routes, auth or not
  if (request.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 });
    applyCorsHeaders(res, origin);
    res.headers.set('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT,OPTIONS');
    res.headers.set(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );
    return res;
  }

  // Auth check — only for /api/auth/:path*
  if (pathname.startsWith('/api/auth/')) {
    const token = request.cookies.get('session')?.value;
    if (!token) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return applyCorsHeaders(res, origin);
    }
  }

  // Cookie exists (or route doesn't need auth) — let it through, but still stamp CORS headers
  const res = NextResponse.next();
  return applyCorsHeaders(res, origin);
}

export const config = {
  matcher: ['/api/:path*'],
};