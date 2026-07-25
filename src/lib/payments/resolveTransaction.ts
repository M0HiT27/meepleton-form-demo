import { prisma } from '@/lib/prisma';

type Resolution = 'SUCCESS' | 'FAILED' | 'REFUNDED';

// Which Transaction.status a resolution is allowed to transition FROM.
// SUCCESS/FAILED both resolve a PENDING payment attempt. REFUNDED is
// different — it only ever applies to a transaction that already
// succeeded, so its guard must check against SUCCESS, not PENDING.
const ALLOWED_FROM_STATUS: Record<Resolution, 'PENDING' | 'SUCCESS'> = {
  SUCCESS: 'PENDING',
  FAILED: 'PENDING',
  REFUNDED: 'SUCCESS',
};

/**
 * Resolves a transaction to SUCCESS, FAILED, or REFUNDED, and does the
 * matching purchase/slot bookkeeping in one atomic DB transaction.
 *
 * This is the single source of truth for "what happens when we learn a
 * payment's outcome changed" — the payment gateway's webhook handler, the
 * sweep cron, and any admin-initiated refund flow all call this same
 * function. Whichever caller gets there first wins; the others become a
 * safe no-op via the status guard below. Do not duplicate this logic
 * elsewhere — if callers ever diverge in how they release slots, that
 * reopens the overbooking race the whole reserve/confirm/release design
 * was built to close.
 *
 * @param transactionId    our own Transaction.id
 * @param resolution       'SUCCESS' | 'FAILED' | 'REFUNDED'
 * @param gatewayPaymentId the gateway's own payment/txn id, if known
 *                         (only meaningful on SUCCESS; omit otherwise)
 * @returns true if this call actually changed anything, false if the
 *          transaction wasn't in the expected starting status (already
 *          resolved by another path, or resolution doesn't apply yet)
 */
export async function resolveTransaction(
  transactionId: number,
  resolution: Resolution,
  gatewayPaymentId: string | null = null,
  paymentMethod: string | null = null // e.g. "upi" | "card" | "netbanking" — only meaningful on SUCCESS
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const fromStatus = ALLOWED_FROM_STATUS[resolution];

    // Idempotency guard: only ever transition from the expected starting
    // status. Protects against webhook retries (Razorpay/Paytm both use
    // at-least-once delivery), against the sweep job racing a webhook that
    // arrives mid-check, and against a refund being processed twice.
    const updated = await tx.transaction.updateMany({
      where: { id: transactionId, status: fromStatus },
      data: {
        status: resolution,
        ...(gatewayPaymentId ? { transaction_id: gatewayPaymentId } : {}),
        // Only ever set on SUCCESS — this is the first point the actual
        // method the user chose inside the checkout widget is known.
        ...(resolution === 'SUCCESS' && paymentMethod ? { payment_method: paymentMethod } : {}),
      },
    });

    if (updated.count === 0) {
      // Not in the expected starting status — already resolved by another
      // path, or this resolution doesn't apply yet. Nothing to do.
      return false;
    }

    const purchase = await tx.playerPassPurchase.findUnique({
      where: { transaction_id: transactionId },
      include: { selected_games: true },
    });

    if (!purchase) {
      // Shouldn't happen given the 1:1 constraint, but don't silently
      // swallow it — a Transaction with no linked purchase is a data
      // integrity problem worth surfacing.
      console.error(
        `⚠️ Transaction ${transactionId} resolved to ${resolution} but has no linked PlayerPassPurchase`
      );
      return true;
    }

    if (resolution === 'SUCCESS') {
      await tx.playerPassPurchase.update({
        where: { id: purchase.id },
        data: { status: 'CONFIRMED' },
      });
      // Slots stay booked — no change to current_booked_slots.
      return true;
    }

    // FAILED and REFUNDED both release every slot this purchase was
    // holding, and both map PlayerPassPurchase.status 1:1 to the same name
    // as the Transaction resolution.
    await tx.playerPassPurchase.update({
      where: { id: purchase.id },
      data: { status: resolution }, // 'FAILED' | 'REFUNDED'
    });

    for (const sel of purchase.selected_games) {
      await tx.$executeRaw`
        UPDATE games
        SET current_booked_slots = current_booked_slots - 1
        WHERE id = ${sel.game_id}
      `;
    }

    return true;
  });
}