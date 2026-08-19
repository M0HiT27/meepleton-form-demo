// app\api\auth\games\with-players\route.ts
//
// GET /api/auth/games/with-players?page=1&pageSize=10
//
// Returns games paginated at the Game level. Each game carries an array
// of its CONFIRMED players only (pending/failed/cancelled/refunded
// purchases are excluded entirely — they're not "players" yet/anymore).
//
// Mirrors app/api/auth/passes/with-players/route.ts, but pivoted from
// Pass -> purchases to Game -> PlayerPassSelectedGameMapping -> purchase,
// since a purchase's selected games are what link a player to a Game.

import { NextRequest, NextResponse } from "next/server";
import { PurchaseStatus } from "@/generated/prisma";
import { prisma } from '@/lib/prisma';
import convertTimeZone from '@/lib/timezone-converter';
import { requireAuth } from "@/lib/auth";


const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

interface PlayerDTO {
  playerName: string;
  playerNumber: string; // dial_code + mobile, concatenated
  email: string;
  address: string;
  city: string;
  passId: number;
  passName: string;
//   selectedGames: string[]; // all game names on this purchase, not just this game
  purchaseTime: string; // ISO string
  amountPaid: number | null; // from linked transaction
  modeOfPayment: string | null; // transaction.payment_method
  invoiceUrl: string | null; // transaction.invoice_url
}

interface GameDTO {
  id: number;
  name: string;
  players: PlayerDTO[];
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('response' in auth) return auth.response;
    const { searchParams } = new URL(request.url);

    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");

    const page = Math.max(1, parseInt(pageParam ?? "1", 50) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(pageSizeParam ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
    );

    const totalItems = await prisma.game.count();
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    const games = await prisma.game.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        playerPassSelections: {
          // Only surface selections whose purchase is CONFIRMED — a
          // pending/failed/cancelled/refunded purchase means the player
          // never actually secured a slot in this game.
          where: {
            purchase: { status: PurchaseStatus.CONFIRMED },
          },
          orderBy: { purchase: { purchase_time: "asc" } },
          select: {
            purchase: {
              select: {
                name: true,
                email: true,
                mobile: true,
                dial_code: true,
                address: true,
                city: true,
                purchase_time: true,
                invoice_url: true,
                pass: {
                  select: { id: true, name: true },
                },
                transaction: {
                  select: {
                    amount: true,
                    payment_method: true,
                  },
                },
                selected_games: {
                  select: {
                    game: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const data: GameDTO[] = games.map((game) => ({
      id: game.id,
      name: game.name,
      players: game.playerPassSelections.map(({ purchase }) => ({
        playerName: purchase.name,
        // Concatenated as-is; dial_code is stored separately (e.g. "+91")
        // so a raw concat gives "+919876543210" without re-formatting here.
        playerNumber: `${purchase.dial_code}${purchase.mobile}`,
        email: purchase.email,
        address: purchase.address,
        city: purchase.city,
        passId: purchase.pass.id,
        passName: purchase.pass.name,
        // selectedGames: purchase.selected_games.map((sg) => sg.game.name),
        purchaseTime: convertTimeZone(purchase.purchase_time.toISOString()).formatted,
        amountPaid: purchase.transaction?.amount ? purchase.transaction.amount / 100 : null,
        modeOfPayment: purchase.transaction?.payment_method ?? null,
        invoiceUrl: purchase.invoice_url ?? null,
      })),
    }));

    return NextResponse.json(
      {
        success: true,
        data,
        meta: {
          page,
          pageSize,
          totalItems,
          totalPages,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/games] failed:", error);
    return NextResponse.json(
      {
        success: false,
        data: [],
        meta: null,
        error: "Failed to fetch games",
      },
      { status: 500 }
    );
  }
}