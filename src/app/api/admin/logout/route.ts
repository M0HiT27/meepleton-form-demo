// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();

  cookieStore.set('session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // expire immediately
    domain: process.env.NODE_ENV === 'production'
      ? process.env.ADMIN_PORTAL_DOMAIN
      : undefined,
  });

  return NextResponse.json({ ok: true });
}