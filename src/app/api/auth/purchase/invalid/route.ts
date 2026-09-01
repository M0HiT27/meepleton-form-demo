import { requireAuth } from "@/lib/auth";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GameDifficulty, PurchaseStatus } from '@/generated/prisma';

// GET /api/purchases/invalid
//
// Finds CONFIRMED purchases whose current game selection no longer
// satisfies their pass's rules. A purchase is "invalid" if any of:
//   1. selected_games.length !== pass.required_selection_count
//   2. heavy_selected_count < pass.minimum_difficult_games_to_select
//   3. one or more selected games are no longer in the pass's pool
//      (e.g. the pass's GameToPassMapping was edited after purchase)
//
// This is a read-only audit endpoint — it doesn't touch slots or
// selections, just reports which purchases need attention.
//
// NOTE on (2): "mismatch" here means falling below the required
// minimum, matching the same check used when selections are made in
// PUT /api/purchases/[purchaseId]/selected-games. If you actually want
// an exact-equality check instead, swap `<` for `!==` below.
export async function GET() {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;

  const purchases = await prisma.playerPassPurchase.findMany({
    where: { status: PurchaseStatus.CONFIRMED },
    select: {
      id: true,
      email: true,
      name: true,
      mobile: true,
      pass: {
        select: {
          id: true,
          name: true,
          
          required_selection_count: true,
          minimum_difficult_games_to_select: true,
          games: { select: { game_id: true } }, // pool via GameToPassMapping
        },
      },
      selected_games: {
        select: {
          game: { select: { id: true, difficulty: true } },
        },
      },
    },
  });

  const invalid = purchases.filter((purchase) => {
    const poolGameIds = new Set(purchase.pass.games.map((g) => g.game_id));
    const selectedGames = purchase.selected_games.map((sg) => sg.game);
    const countMismatch = selectedGames.length !== purchase.pass.required_selection_count;

    const heavyCount = selectedGames.filter((g) => g.difficulty === GameDifficulty.HEAVY).length;
    const difficultyMismatch = heavyCount < purchase.pass.minimum_difficult_games_to_select;

    const hasStaleGame = selectedGames.some((g) => !poolGameIds.has(g.id));

    return countMismatch || difficultyMismatch || hasStaleGame;
  });

  return NextResponse.json(
    invalid.map((purchase) => ({
      id: purchase.id,
      email: purchase.email,
      name: purchase.name,
      pass_name: purchase.pass.name,
    }))
  );
}