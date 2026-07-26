import type {
  PlayerPassPurchase,
  Pass,
  Transaction,
  PlayerPassSelectedGameMapping,
  Game,
} from "@/generated/prisma"; // adjust path to your prisma client output

type PurchaseForMail = PlayerPassPurchase & {
  pass: Pass;
  transaction: Transaction;
  selected_games: (PlayerPassSelectedGameMapping & { game: Game })[];
};

export default async function sendConfirmationMail(data: PurchaseForMail , invoiceUrl : string) {
  const BREVO_API_URL = process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email";
  const BREVO_TEMPLATE_ID = process.env.BREVO_TEMPLATE_ID; // pass_purchase_confirmation
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not set");
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!senderEmail) {
    throw new Error("BREVO_SENDER_EMAIL is not set");
  }

  const purchaseTime = new Date(data.purchase_time).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

  const payload = {
    sender: {
      name: process.env.BREVO_SENDER_NAME ?? "Board Game Nights",
      email: senderEmail,
    },
    templateId: Number(BREVO_TEMPLATE_ID),
    to: [{ email: data.email, name: data.name }],
    params: {
      NAME: data.name,
      PASS_NAME: data.pass.name,
      // gateway's own transaction id if present, falling back to our internal PK
      TRANSACTION_ID: data.transaction.transaction_id ?? String(data.transaction.id),
      PURCHASE_TIME: purchaseTime,
      AMOUNT: String(
        data.transaction?.amount != null
          ? data.transaction.amount / 100
          : data.pass.price
      ),
      INVOICE_URL: invoiceUrl,
      GAMES: data.selected_games.map((sg) => ({ NAME: sg.game.name })),
    },
  };

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Brevo send failed (${res.status}): ${errorBody}`);
  }

  return res.json();
}