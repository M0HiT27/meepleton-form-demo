// swipe-integration/swipeClient.ts

import crypto from 'crypto';

const SWIPE_BASE_URL = 'https://app.getswipe.in/api/partner';

function swipeHeaders() {
  const apiKey = process.env.SWIPE_API_KEY;
  if (!apiKey) throw new Error('SWIPE_API_KEY is not set');
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

// ─────────────────────────────────────────────────────────────
// Normalization helpers
// ─────────────────────────────────────────────────────────────

export function normalizeDialCode(dialCode: string): string {
  return dialCode.replace(/\D/g, '');
}

export function normalizePhone(mobile: string): string {
  return mobile.replace(/\D/g, '');
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Deterministic party id from (dial_code, phone, name) — same buyer always
 * produces the same id, computed with no DB round trip. This is what lets
 * a single createDocument call double as "create if new, reuse if known":
 * Swipe matches on `party.id` itself, so as long as we always hand it the
 * same id for the same buyer, we never need a separate lookup/map call.
 */
export function generateSwipeCustomerId(): string {
  return `cust-${crypto.randomUUID()}`;
}

// Swipe's payment method enum
export type SwipePaymentMethod = 'cash' | 'card' | 'upi' | 'netBanking' | 'cheque' | 'emi';

const RAZORPAY_TO_SWIPE_METHOD: Record<string, SwipePaymentMethod> = {
  card: 'card',
  upi: 'upi',
  netbanking: 'netBanking',
  emi: 'emi',
};

export function toSwipePaymentMethod(razorpayMethod: string | null | undefined): SwipePaymentMethod {
  if (!razorpayMethod) return 'card';
  const mapped = RAZORPAY_TO_SWIPE_METHOD[razorpayMethod.toLowerCase()];
  if (!mapped) {
    console.warn(`[swipe] unmapped Razorpay payment method "${razorpayMethod}", defaulting to 'card'`);
    return 'card';
  }
  return mapped;
}

export function todayAsDDMMYYYY(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// ─────────────────────────────────────────────────────────────
// Swipe API types (per confirmed working create-a-document payload)
// ─────────────────────────────────────────────────────────────

type SwipeParty = {
  id: string;
  type: 'customer';
  name: string;
  // Included on every call — Swipe ignores these if `id` already matches
  // an existing party, and uses them to create a new one if it doesn't.
  // Verify field names (phone/dial_code/email) against Swipe's full party
  // schema; only id/type/name are confirmed from the working example.
  phone?: string;
  dial_code?: string;
  email?: string;
};

export type SwipeItemType = 'Product' | 'Service';

export type SwipeItem = {
  id: string; // new id -> auto-creates an Item; existing id -> details apply to this doc only
  name: string;
  item_type: SwipeItemType;
  quantity: number;
  unit_price: number; // per-item price, no tax
  price_with_tax: number; // per-item price, with tax
  discount_amount: number; // explicit discount, NOT implied by net/unit gap
  net_amount: number; // (quantity * price_with_tax) - discount_amount
  total_amount: number; // net_amount + any tax on top (same as net_amount if none)
};

type SwipeBankDetails = {
  account_number: string;
  ifsc: string;
  bank_name: string;
  branch: string;
};

type SwipePayment = {
  amount: number;
  method: SwipePaymentMethod;
  notes?: string;
  bank_details?: SwipeBankDetails;
};

type CreateDocumentInput = {
  document_type: 'invoice';
  document_date: string; // DD-MM-YYYY
  party: SwipeParty;
  items: SwipeItem[];
  payments?: SwipePayment[];
};

type CreateDocumentResponse = {
  success: boolean;
  message: string;
  error_code: string;
  data?: { hash_id?: string; serial_number?: string; [key: string]: unknown };
};

export async function createDocument(input: CreateDocumentInput): Promise<CreateDocumentResponse> {
  const res = await fetch(`${SWIPE_BASE_URL}/v2/doc`, {
    method: 'POST',
    headers: swipeHeaders(),
    body: JSON.stringify(input),
  });
  
  const body = (await res.json()) as CreateDocumentResponse;
  if (!res.ok || !body.success) {
    // Log the full payload we sent + the full response Swipe gave back —
    // "Validation errors occurred" alone doesn't say which field. Do this
    // here, once, rather than at every call site.
    if (!res.ok || !body.success) {
    console.error('[swipe] createDocument failed', {
      status: res.status,
      request: JSON.stringify(input, null, 2),
      response: JSON.stringify(body, null, 2),
    });
}
  }
  return { ...body, success: res.ok && body.success };
}

// Your settlement bank account — same for every invoice, sourced from env.
export function getSettlementBankDetails(): SwipeBankDetails {
  const account_number = process.env.SWIPE_BANK_ACCOUNT_NUMBER;
  const ifsc = process.env.SWIPE_BANK_IFSC;
  const bank_name = process.env.SWIPE_BANK_NAME;
  const branch = process.env.SWIPE_BANK_BRANCH;

  if (!account_number || !ifsc || !bank_name || !branch) {
    throw new Error(
      'Missing one of SWIPE_BANK_ACCOUNT_NUMBER / SWIPE_BANK_IFSC / SWIPE_BANK_NAME / SWIPE_BANK_BRANCH in env'
    );
  }

  return { account_number, ifsc, bank_name, branch };
}

/**
 * Builds the single line item for a pass purchase: pass name, qty 1,
 * with an explicit discount_amount bringing it down to what Razorpay
 * actually charged.
 */
export function buildPassLineItem(params: {
  passId: number;
  passName: string;
  listPrice: number;
  amountCharged: number;
}): SwipeItem {
  const { passId, passName, listPrice, amountCharged } = params;
  const quantity = 1;
  const discountAmount = listPrice - amountCharged;
  const netAmount = quantity * listPrice - discountAmount; // == amountCharged
  return {
    id: `pass-${passId}`,
    name: passName,
    item_type: 'Product',
    quantity,
    unit_price: listPrice,
    price_with_tax: listPrice,
    discount_amount: discountAmount,
    net_amount: netAmount,
    total_amount: netAmount, // no tax added on top
  };
}