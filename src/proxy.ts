// proxy.ts
import { NextRequest, NextResponse } from 'next/server';

export default function proxy(request: NextRequest) {
  const token = request.cookies.get('session')?.value;

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Cookie exists — let the request through.
  // Do NOT verify against a DB here; that belongs in the route handler itself.
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/auth/:path*'],
};