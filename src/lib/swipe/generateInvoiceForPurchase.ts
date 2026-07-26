// swipe-integration/generateInvoiceForPurchase.ts

import { prisma } from '@/lib/prisma';
import {
  buildPassLineItem,
  createDocument,
  generateSwipeCustomerId,
  getSettlementBankDetails,
  normalizeDialCode,
  normalizeName,
  normalizePhone,
  todayAsDDMMYYYY,
  toSwipePaymentMethod,
} from './swipeClient';

type PurchaseForInvoice = {
  id: number;
  pass_id: number;
  name: string;
  email: string;
  dial_code: string;
  mobile: string;
  pass: { name: string; price: number };
  transaction: { payment_method: string | null; amount_charged: number | null };
};

/**
 * Main entry point — call this right after a purchase resolves to CONFIRMED.
 *
 * Single createDocument call handles create-or-reuse: `party.id` is
 * deterministic from (dial_code, phone, name), so the same buyer always
 * gets the same party id. If Swipe already has that id, it matches and
 * ignores the name/phone/email we send; if not, it creates a new party
 * from them. No separate lookup/map call needed either way.
 */
export async function generateInvoiceForPurchase(purchase: PurchaseForInvoice): Promise<string> {
  // Idempotency: if this purchase already has an invoice, return it as-is
  // rather than creating a second Swipe document for the same sale.
  const existing = await prisma.playerPassPurchase.findUnique({
    where: { id: purchase.id },
    select: { invoice_url: true },
  });
  if (existing?.invoice_url) {
    return existing.invoice_url;
  }

  const dialKey = normalizeDialCode(purchase.dial_code);
  const phoneKey = normalizePhone(purchase.mobile);
  const nameKey = normalizeName(purchase.name);
  const cached = await prisma.swipeCustomerMap.findUnique({
    where: {
      dial_code_phone_normalized_name_normalized: {
        dial_code: dialKey,
        phone_normalized: phoneKey,
        name_normalized: nameKey,
      },
    },
  });

  // Reuse the known id if this buyer already has a Swipe party; otherwise
  // mint a new one. Either way we still send full name/phone/email in
  // `party` — Swipe ignores them on a match, uses them to create on a miss.
  const swipeCustomerId = cached?.customer_id ?? generateSwipeCustomerId();

  const swipeMethod = toSwipePaymentMethod(purchase.transaction.payment_method);
  const amountCharged = purchase.transaction.amount_charged;

  if (amountCharged == null) {
    throw new Error(`Transaction for purchase ${purchase.id} has no amount_charged — cannot compute discount`);
  }

  const item = buildPassLineItem({
    passId: purchase.pass_id,
    passName: purchase.pass.name,
    listPrice: purchase.pass.price,
    amountCharged,
  });

  const doc = await createDocument({
    document_type: 'invoice',
    document_date: todayAsDDMMYYYY(),
    party: {
      id: swipeCustomerId,
      type: 'customer',
      name: purchase.name,
      country_code: dialKey,
      phone_number: purchase.mobile,
      email: purchase.email,
    },
    items: [item],
    payments: [
      {
        amount: amountCharged / 100, // TODO: confirm rupees vs paise
        method: swipeMethod,
        ...(swipeMethod !== 'cash' ? { bank_details: getSettlementBankDetails() } : {}),
      },
    ],
  });

  if (!doc.success || !doc.data?.hash_id) {
    throw new Error(`Swipe document creation failed: ${doc.message} (${doc.error_code})`);
  }

  const invoiceUrl = `https://swipe.pe/view/${doc.data.hash_id}`;

  // Bookkeeping only now — not required for the create-or-reuse logic
  // itself, since swipeCustomerId is deterministic and needs no lookup.
  // Kept for audit/admin visibility into which buyers have a Swipe party.
  await prisma.swipeCustomerMap.upsert({
    where: {
      dial_code_phone_normalized_name_normalized: {
        dial_code: dialKey,
        phone_normalized: phoneKey,
        name_normalized: nameKey,
      },
    },
    update: {},
    create: {
      dial_code: dialKey,
      phone_normalized: phoneKey,
      name_normalized: nameKey,
      customer_id: swipeCustomerId,
    },
  });

  await prisma.playerPassPurchase.update({
    where: { id: purchase.id },
    data: {
      swipe_doc_hash_id: doc.data.hash_id,
      invoice_url: invoiceUrl,
    },
  });

  return invoiceUrl;
}