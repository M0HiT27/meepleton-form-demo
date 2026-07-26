import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { resolveTransaction } from '@/lib/payments/resolveTransaction';

/**
 * Verifies Razorpay's webhook signature. This is not optional — without it,
 * anyone who finds this URL could POST a fake "payment.captured" event and
 * get a purchase marked CONFIRMED without ever paying. Razorpay signs the
 * raw request body with your webhook secret (HMAC SHA-256); we recompute
 * the same signature and compare.
 */
function isValidSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  // Constant-time comparison — avoids leaking timing information that could
  // help an attacker guess a valid signature byte-by-byte.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  // Must read the RAW body for signature verification — parsing to JSON
  // first and re-stringifying can change whitespace/key order and break
  // the signature check.
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature');

  if (!isValidSignature(rawBody, signature)) {
    console.error('Razorpay webhook: invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const eventType: string = event.event;

  // payment.captured / payment.failed are the two outcomes we act on.
  // Anything else (order.paid, refund.processed, etc.) is acknowledged
  // but ignored here — refunds get their own explicit trigger, not this
  // webhook, since REFUNDED requires an already-SUCCESS transaction and
  // that flow isn't wired up here yet.
  if (eventType !== 'payment.captured' && eventType !== 'payment.failed') {
    return NextResponse.json({ success: true, ignored: eventType });
  }

  const payment = event.payload?.payment?.entity;
  const razorpayOrderId: string | undefined = payment?.order_id;
  const razorpayPaymentId: string | undefined = payment?.id;
  const razorpayPaymentMethod: string | undefined = payment?.method; // "upi" | "card" | "netbanking" | "wallet" | ...
  const razorpayAmount: number | undefined = payment?.amount; // paise — matches Pass.price's smallest-unit convention

  if (!razorpayOrderId) {
    console.error('Razorpay webhook: missing order_id in payload', event);
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { gateway_order_id: razorpayOrderId },
  });

  if (!transaction) {
    // Could happen if the order was created but our reservation call never
    // finished (shouldn't be possible given the flow, but don't crash the
    // webhook over it — log and acknowledge so Razorpay doesn't retry
    // forever on something we can't resolve).
    console.error(`Razorpay webhook: no Transaction for order ${razorpayOrderId}`);
    return NextResponse.json({ success: true, warning: 'transaction not found' });
  }

  const resolution = eventType === 'payment.captured' ? 'SUCCESS' : 'FAILED';
  await resolveTransaction(
    transaction.id,
    resolution,
    razorpayPaymentId ?? null,
    razorpayPaymentMethod ?? null,
    // Only meaningful on SUCCESS — resolveTransaction itself ignores this
    // arg for FAILED, but no harm passing it through either way.
    razorpayAmount ?? null
  );

  // Respond quickly with 200 — Razorpay retries on non-2xx, and
  // resolveTransaction's own idempotency guard makes retries safe anyway.
  return NextResponse.json({ success: true });
}