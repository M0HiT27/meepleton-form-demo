/**
 * Looks up a payment's actual status directly from Razorpay, rather than
 * assuming failure just because our own PENDING row is stale. A slow but
 * genuine webhook can still be in flight — this call is what tells the
 * sweep job the difference between "actually failed" and "just slow."
 *
 * Razorpay does not expose a direct "fetch by our ORDER_ID" lookup for an
 * order that may have zero, one, or several payment attempts against it,
 * so this fetches the order's payments and looks for one that succeeded.
 * Adjust the endpoint/parsing here if you're on Paytm instead — the rest
 * of the sweep flow (resolveTransaction) does not need to change.
 */
interface VerifyResult {
  status: 'SUCCESS' | 'FAILED' | 'STILL_PENDING';
  paymentId: string | null;
  paymentMethod: string | null;
  amountCharged: number | null; // paise, straight from Razorpay — matches Pass.price's smallest-unit convention
}

export async function verifyRazorpayPayment(
  razorpayOrderId: string
): Promise<VerifyResult> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials not configured');
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const res = await fetch(
    `https://api.razorpay.com/v1/orders/${razorpayOrderId}/payments`,
    {
      headers: { Authorization: `Basic ${auth}` },
    }
  );

  if (!res.ok) {
    // Treat a failed status check as "still pending" — we'd rather retry
    // next sweep than wrongly release a slot on an API hiccup.
    console.error(
      `Razorpay status check failed for order ${razorpayOrderId}: ${res.status}`
    );
    return { status: 'STILL_PENDING', paymentId: null, paymentMethod: null, amountCharged: null };
  }

  const data = await res.json();
  const payments: Array<{ status: string; id: string; method?: string; amount?: number }> =
    data.items ?? [];

  const captured = payments.find((p) => p.status === 'captured');
  if (captured) {
    return {
      status: 'SUCCESS',
      paymentId: captured.id,
      paymentMethod: captured.method ?? null,
      amountCharged: captured.amount ?? null,
    };
  }

  // If every attempt against this order has failed, or there are no
  // attempts at all after the timeout window, treat it as failed.
  const allFailedOrEmpty =
    payments.length === 0 || payments.every((p) => p.status === 'failed');

  return {
    status: allFailedOrEmpty ? 'FAILED' : 'STILL_PENDING',
    paymentId: null,
    paymentMethod: null,
    amountCharged: null,
  };
}