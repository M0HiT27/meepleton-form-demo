import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveTransaction } from '@/lib/payments/resolveTransaction';
import { verifyRazorpayPayment } from '@/lib/payments/verifyRazorpayPayment';

// How long a payment can sit PENDING before we consider it stale enough to
// double-check with the gateway. Keep this comfortably longer than a normal
// checkout takes, so we're not racing a genuinely slow-but-fine payment.
const STALE_AFTER_MINUTES = 10;

export async function GET(req: Request) {
  // This route is hit by an external scheduler (cron-job.org / GitHub
  // Actions / etc.), not Vercel's own Cron — see project context for why.
  // Guard it with a shared secret so it can't be triggered by anyone who
  // finds the URL.
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const staleThreshold = new Date(Date.now() - STALE_AFTER_MINUTES * 60 * 1000);

  const staleTransactions = await prisma.transaction.findMany({
    where: {
      status: 'PENDING',
      transaction_time: { lt: staleThreshold },
    },
  });

  const results = {
    checked: staleTransactions.length,
    resolvedSuccess: 0,
    resolvedFailed: 0,
    stillPending: 0,
    skippedNoOrderId: 0,
    errors: [] as string[],
  };

  for (const txn of staleTransactions) {
    try {
      if (!txn.gateway_order_id) {
        // Reservation was created but the gateway order was never even
        // set up (e.g. user abandoned before checkout actually started).
        // Nothing to verify against — resolve straight to FAILED so the
        // slot doesn't stay held forever.
        const changed = await resolveTransaction(txn.id, 'FAILED');
        if (changed) results.resolvedFailed++;
        results.skippedNoOrderId++;
        continue;
      }

      // Ask the gateway directly — don't assume failure just because our
      // row is stale. A slow-but-real webhook may still be in flight.
      const result = await verifyRazorpayPayment(txn.gateway_order_id);

      if (result.status === 'SUCCESS') {
        const changed = await resolveTransaction(
          txn.id,
          'SUCCESS',
          result.paymentId,
          result.paymentMethod,
          result.amountCharged
        );
        if (changed) results.resolvedSuccess++;
      } else if (result.status === 'FAILED') {
        const changed = await resolveTransaction(txn.id, 'FAILED');
        if (changed) results.resolvedFailed++;
      } else {
        // STILL_PENDING — leave it alone, it'll be picked up by a later
        // sweep once it's actually old enough for the gateway to have a
        // final answer, or once the webhook arrives on its own.
        results.stillPending++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Sweep failed for transaction ${txn.id}:`, message);
      results.errors.push(`transaction ${txn.id}: ${message}`);
      // Deliberately don't resolve on error — better to retry next sweep
      // than to wrongly release a slot because of a transient failure
      // (e.g. the DB was mid cold-start, or Razorpay's API hiccuped).
    }
  }

  return NextResponse.json({ success: true, ...results });
}