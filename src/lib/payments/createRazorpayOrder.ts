/**
 * Creates a Razorpay Order for the given amount. Razorpay generates its own
 * order id server-side (unlike Paytm, where you supply your own reference)
 * — that returned id is what gets saved into Transaction.gateway_order_id
 * so the webhook and sweep job can look the payment back up later.
 */
export async function createRazorpayOrder(params: {
  amountInPaise: number;
  receipt: string; // our own Transaction.id, stringified — shows up in Razorpay's dashboard for cross-referencing
}): Promise<{ id: string }> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials not configured');
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amountInPaise,
      currency: 'INR',
      receipt: params.receipt,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Razorpay order creation failed (${res.status}): ${body}`);
  }

  return res.json();
}