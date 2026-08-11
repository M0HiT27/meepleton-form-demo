// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Username and password required' },
      { status: 400 }
    );
  }

  const admin = await prisma.admin.findUnique({ where: { username } });

  if (!admin) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const isValid = await bcrypt.compare(password, admin.password);

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await new SignJWT({ id: admin.id, username: admin.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day, in seconds
    // localhost doesn't accept an explicit domain attribute — only set it in prod
    domain: process.env.NODE_ENV === 'production'
      ? process.env.ADMIN_PORTAL_DOMAIN
      : undefined,
  });

  return NextResponse.json({ ok: true, username: admin.username });
}