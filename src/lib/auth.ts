// lib/auth.ts
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export interface SessionPayload {
  id: string;
  username: string;
}

/**
 * Verifies the session cookie and returns the decoded payload,
 * or null if missing/invalid/expired.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    // covers expired, malformed, or bad-signature tokens
    return null;
  }
}

/**
 * Use inside a route handler when you want to bail out early
 * with a 401 if there's no valid session.
 */
export async function requireAuth(): Promise<
  { session: SessionPayload } | { response: NextResponse }
> {
  const session = await getSession();

  if (!session) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { session };
}