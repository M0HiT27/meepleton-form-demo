import { prisma } from '@/lib/prisma';
import sendConfirmationMail from '@/lib/mail/mail-sender'; // adjust to actual path
import { generateInvoiceForPurchase } from '@/lib/swipe/generateInvoiceForPurchase';

type Resolution = 'SUCCESS' | 'FAILED' | 'REFUNDED';

const ALLOWED_FROM_STATUS: Record<Resolution, 'PENDING' | 'SUCCESS'> = {
  SUCCESS: 'PENDING',
  FAILED: 'PENDING',
  REFUNDED: 'SUCCESS',
};

export async function resolveTransaction(
  transactionId: number,
  resolution: Resolution,
  gatewayPaymentId: string | null = null,
  paymentMethod: string | null = null,
  amountCharged: number | null = null
): Promise<boolean> {
  const changed = await prisma.$transaction(async (tx) => {
    const fromStatus = ALLOWED_FROM_STATUS[resolution];

    const updated = await tx.transaction.updateMany({
      where: { id: transactionId, status: fromStatus },
      data: {
        status: resolution,
        ...(gatewayPaymentId ? { transaction_id: gatewayPaymentId } : {}),
        ...(resolution === 'SUCCESS' && paymentMethod ? { payment_method: paymentMethod } : {}),
        // Field is `amount` on the actual schema, not `amount_charged`.
        ...(resolution === 'SUCCESS' && amountCharged != null ? { amount: amountCharged } : {}),
      },
    });

    if (updated.count === 0) {
      return false;
    }

    const purchase = await tx.playerPassPurchase.findUnique({
      where: { transaction_id: transactionId },
      include: { selected_games: true },
    });

    if (!purchase) {
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
      return true;
    }

    await tx.playerPassPurchase.update({
      where: { id: purchase.id },
      data: { status: resolution },
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

  if (changed && resolution === 'SUCCESS') {
    try {
      const purchase = await prisma.playerPassPurchase.findUnique({
        where: { transaction_id: transactionId },
        include: {
          pass: true,
          transaction: true,
          selected_games: { include: { game: true } },
        },
      });

      if (purchase) {
        const invoiceURL = await generateInvoiceForPurchase({
          id: purchase.id,
          pass_id: purchase.pass_id,
          name: purchase.name,
          email: purchase.email,
          dial_code: purchase.dial_code,
          mobile: purchase.mobile,
          pass: { name: purchase.pass.name, price: purchase.pass.price },
          transaction: {
            payment_method: purchase.transaction.payment_method,
            // Read from `amount`, matching the actual column.
            amount_charged: purchase.transaction.amount,
          },
        });

        await sendConfirmationMail(purchase, invoiceURL);
      }
    } catch (err) {
      console.error(`⚠️ Failed to generate invoice / send confirmation mail for transaction ${transactionId}:`, err);
    }
  }

  return changed;
}