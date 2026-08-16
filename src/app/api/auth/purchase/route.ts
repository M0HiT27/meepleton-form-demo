import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { resolveTransaction } from '@/lib/payments/resolveTransaction';
import { requireAuth } from "@/lib/auth";
interface ReservationBody {
  pass_id: number;
  selected_game_ids: number[];
  buyer: {
    name: string;
    email: string;
    mobile: string;
    dial_code:string;
    city: string;
    pincode: string;
    address: string;
  };
  amount_paid : number
}

export async function POST(req: Request) {
    const body = (await req.json()) as ReservationBody;
    const { pass_id, selected_game_ids, buyer , amount_paid } = body;
    const auth = await requireAuth();
    if ('response' in auth) return auth.response;

  if (!pass_id) {
    return NextResponse.json(
      { success: false, error: 'No pass selected' },
      { status: 400 }
    );
  }
  
  if (!buyer?.name || !buyer?.email || !buyer?.mobile) {
    return NextResponse.json(
      { success: false, error: 'Buyer name, email, and mobile are required' },
      { status: 400 }
    );
  }

  const now = new Date();

  const pass = await prisma.pass.findUnique({
    where: { id: pass_id },
    include: { pass_offer: true, games: true },
  });
  
  if (!pass) {
    return NextResponse.json({ success: false, error: 'Pass not found' }, { status: 404 });
  }
  if (pass.required_selection_count > 0 && (!Array.isArray(selected_game_ids) || !selected_game_ids.length)) {
    return NextResponse.json(
      { success: false, error: `Select ${pass.required_selection_count} games` },
      { status: 400 }
    );
  }
  if (now < pass.start_time || now > pass.end_time) {
    return NextResponse.json(
      { success: false, error: 'This pass is not currently on sale' },
      { status: 400 }
    );
  }
  if (selected_game_ids.length !== pass.required_selection_count) {
    return NextResponse.json(
      {
        success: false,
        error: `This pass requires exactly ${pass.required_selection_count} game selections`,
      },
      { status: 400 }
    );
  }
  if (pass.minimum_difficult_games_to_select > 0) {
    const selectedDifficultGames = await prisma.game.findMany({
      where: { id: { in: selected_game_ids }, difficulty: 'HEAVY' },
    });
    if (selectedDifficultGames.length < pass.minimum_difficult_games_to_select) {
      return NextResponse.json(
        {
          success: false,
          error: `This pass requires at least ${pass.minimum_difficult_games_to_select} heavy games`,
        },
        { status: 400 }
      );
    }
  }

  // Every selected game must actually belong to this pass's pool.
  const validGameIds = new Set(pass.games.map((g) => g.game_id));
  const invalidSelection = selected_game_ids.find((id) => !validGameIds.has(id));
  if (invalidSelection) {
    return NextResponse.json(
      { success: false, error: `Game ${invalidSelection} is not part of this pass` },
      { status: 400 }
    );
  }

  const discountedPrice  = amount_paid;

  // ── Step 1: reserve — atomic slot increments + PENDING Transaction/Purchase,
  // all in one DB transaction. If any slot is full, everything rolls back.
  let transactionId: number;
  try {
    transactionId = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: { status: 'PENDING' }, // payment_method filled in later, from the webhook payload
      });

      const purchase = await tx.playerPassPurchase.create({
        data: {
          pass_id,
          transaction_id: transaction.id,
          status: 'PENDING',
          name: buyer.name,
          email: buyer.email,
          mobile: buyer.mobile,
          dial_code:buyer.dial_code,
          city: buyer.city,
          pincode: buyer.pincode,
          address: buyer.address,
        },
      });

      for (const gameId of selected_game_ids) {
        // Atomic conditional increment — check-and-increment as a single
        // DB operation, not a read-then-write, so concurrent bookings
        // can't both squeeze past max_slots.
        const affected: number = await tx.$executeRaw`
          UPDATE games
          SET current_booked_slots = current_booked_slots + 1
          WHERE id = ${gameId} AND current_booked_slots < max_slots
        `;
        if (affected === 0) {
          throw new Error(`SLOT_FULL:${gameId}`);
        }

        await tx.playerPassSelectedGameMapping.create({
          data: { player_pass_purchase_id: purchase.id, game_id: gameId },
        });
      }

      return transaction.id;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.startsWith('SLOT_FULL:')) {
      const gameId = message.split(':')[1];
      return NextResponse.json(
        { success: false, error: `Game ${gameId} just sold out — pick a different game` , message:"One or more of the selected games is now full"  },
        { status: 409 }
      );
    }

    // Partial unique index (one PENDING purchase per buyer) violation.
    // Not declared in Prisma's schema, but Prisma still surfaces it as
    // P2002 by reading the underlying Postgres unique_violation error.
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      return NextResponse.json(
        {
          success: false,
          error: 'You already have a payment in progress. Please complete or wait for it to expire.',
        },
        { status: 409 }
      );
    }

    console.error('Reservation failed:', err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }

  try {
    const res = await resolveTransaction(transactionId, 'SUCCESS' , null , "Cash" , discountedPrice * 100);
    if(!res){
        throw Error("Pass resolution failed")
    }
    return NextResponse.json({
      success: true,
      message : "Pass Created",
      data: {
        success : true
      }
    },{status:201});
  } catch (err) {
    console.error('Razorpay order creation failed, releasing reservation:', err);
    await resolveTransaction(transactionId, 'FAILED');
    return NextResponse.json(
      { success: false, error: 'Could not start payment. Please try again.' , message: 'Could not start payment. Please try again.' },
      { status: 502 }
    );
  }
}