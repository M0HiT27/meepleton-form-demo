// app\api\auth\passes\with-players\route.ts
//
// GET /api/auth/passes/with-players?page=1&pageSize=10
//
// Returns passes paginated at the Pass level. Each pass carries an array
// of its CONFIRMED purchases only (pending/failed/cancelled/refunded
// purchases are excluded entirely — they're not "players" yet/anymore).

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
  selectedGames: string[]; // game names
  purchaseTime: string; // ISO string
  amountPaid: number | null; // from linked transaction
  modeOfPayment: string | null; // transaction.payment_method
  invoiceUrl: string | null; // transaction.invoice_url
}

interface PassDTO {
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

    const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(pageSizeParam ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
    );

    const totalItems = await prisma.pass.count();
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    const passes = await prisma.pass.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        purchases: {
          // Only confirmed purchases should surface as "players" on the pass.
          where: { status: PurchaseStatus.CONFIRMED },
          orderBy: { purchase_time: "asc" },
          select: {
            name: true,
            email: true,
            mobile: true,
            dial_code: true,
            address: true,
            city: true,
            purchase_time: true,
            invoice_url: true,
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
    });

    const data: PassDTO[] = passes.map((pass) => ({
      id: pass.id,
      name: pass.name,
      players: pass.purchases.map((purchase) => ({
        playerName: purchase.name,
        // Concatenated as-is; dial_code is stored separately (e.g. "+91")
        // so a raw concat gives "+919876543210" without re-formatting here.
        playerNumber: `${purchase.dial_code}${purchase.mobile}`,
        email: purchase.email,
        address: purchase.address,
        city: purchase.city,
        selectedGames: purchase.selected_games.map((sg) => sg.game.name),
        purchaseTime: convertTimeZone(purchase.purchase_time.toISOString()).formatted,
        amountPaid: purchase.transaction?.amount ?purchase.transaction.amount/100: null,
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
    console.error("[GET /api/passes] failed:", error);
    return NextResponse.json(
      {
        success: false,
        data: [],
        meta: null,
        error: "Failed to fetch passes",
      },
      { status: 500 }
    );
  }
}