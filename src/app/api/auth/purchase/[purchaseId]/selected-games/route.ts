import { requireAuth } from "@/lib/auth";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GameDifficulty, PurchaseStatus } from '@/generated/prisma';

// PUT /api/purchases/[purchaseId]/selected-games
//
// Replaces the set of games a purchase has selected from its pass's pool.
// This mutates Game.current_booked_slots (slots freed by games being
// removed, slots claimed by games being added), so the whole
// deallocate-then-allocate step runs as one DB transaction using the same
// atomic-conditional-UPDATE pattern documented on
// Game.current_booked_slots in schema.prisma — never read-then-write —
// so two concurrent requests can never overbook the same game.

interface UpdateSelectedGamesBody {
  game_ids: number[];
}

// GET /api/purchases/[purchaseId]/selected-games
//
// Read-only view for the frontend: what a purchase currently has
// selected, each game's difficulty, and the pass's selection
// requirements so the UI can show progress (e.g. "3/5 selected,
// 2 HEAVY required").
//
// NOTE: unlike PUT above, this is not gated with requireAuth() — that
// helper is the admin-session check used elsewhere in this codebase,
// and a buyer viewing their own purchase's selections is presumably not
// an admin. If this route is reachable by anyone who knows a purchase
// id, you'll want some form of ownership check here (e.g. a purchase
// token/link, or matching session email+mobile against the purchase)
// before shipping it — swap this comment out for whatever auth pattern
// the rest of the customer-facing routes use.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
    const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  const { purchaseId: purchaseIdParam } = await params;
  const purchaseId = Number(purchaseIdParam);
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    return NextResponse.json({ error: 'Invalid purchase id' }, { status: 400 });
  }

  const purchase = await prisma.playerPassPurchase.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      status: true,
      pass: {
        select: {
          id: true,
          name: true,
          required_selection_count: true,
          minimum_difficult_games_to_select: true,
        },
      },
      selected_games: {
        select: {
          game: {
            select: {
              id: true,
              name: true,
              genre: true,
              difficulty: true,
              estimated_runtime_minutes: true,
            },
          },
        },
        orderBy: { game: { name: 'asc' } },
      },
    },
  });

  if (!purchase) {
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
  }

  const games = purchase.selected_games.map((sg) => sg.game);
  const heavy_selected_count = games.filter((g) => g.difficulty === GameDifficulty.HEAVY).length;

  return NextResponse.json({
    purchase_id: purchase.id,
    status: purchase.status,
    pass: {
      id: purchase.pass.id,
      name: purchase.pass.name,
      required_selection_count: purchase.pass.required_selection_count,
      minimum_difficult_games_to_select: purchase.pass.minimum_difficult_games_to_select,
    },
    selected_games: games, // each includes { id, name, genre, difficulty, estimated_runtime_minutes }
    selected_count: games.length,
    heavy_selected_count,
  });
}

// Thrown when an atomic slot-claim UPDATE affects 0 rows, i.e. the game
// was full (or no longer exists) by the time we tried to claim a slot.
// Thrown *inside* the $transaction callback so Prisma rolls back
// everything — including any decrements already applied — atomically.
class SlotUnavailableError extends Error {
  constructor(public gameId: number) {
    super(`Game ${gameId} has no free slots`);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;

  const { purchaseId: purchaseIdParam } = await params;
  const purchaseId = Number(purchaseIdParam);
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    return NextResponse.json({ error: 'Invalid purchase id' }, { status: 400 });
  }

  let body: UpdateSelectedGamesBody;
  try {
    body = (await req.json()) as UpdateSelectedGamesBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { game_ids } = body;

  // ---- Basic shape validation ----
  if (!Array.isArray(game_ids) || game_ids.length === 0) {
    return NextResponse.json({ error: 'game_ids must be a non-empty array' }, { status: 400 });
  }
  if (!game_ids.every((id) => Number.isInteger(id) && id > 0)) {
    return NextResponse.json({ error: 'game_ids must contain positive integers' }, { status: 400 });
  }

  const uniqueGameIds = Array.from(new Set(game_ids));
  if (uniqueGameIds.length !== game_ids.length) {
    return NextResponse.json({ error: 'game_ids contains duplicates' }, { status: 400 });
  }

  // ---- Load purchase + its pass's pool + current selections ----
  const purchase = await prisma.playerPassPurchase.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      status: true,
      pass_id: true,
      pass: {
        select: {
          id: true,
          required_selection_count: true,
          minimum_difficult_games_to_select: true,
          games: { select: { game_id: true } }, // pool via GameToPassMapping
        },
      },
      selected_games: { select: { game_id: true } },
    },
  });

  if (!purchase) {
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
  }

  // Assumption: only a CONFIRMED purchase has "real" slot allocations
  // worth changing (PENDING purchases haven't necessarily claimed slots
  // yet, and FAILED/CANCELLED/REFUNDED ones already released theirs).
  // Adjust this check if PENDING should also be editable in your flow.
  if (purchase.status !== PurchaseStatus.CONFIRMED) {
    return NextResponse.json(
      { error: `Cannot change game selection for a purchase with status ${purchase.status}` },
      { status: 409 }
    );
  }

  // ---- Referential validation: every requested game must be in this pass's pool ----
  const poolGameIds = new Set(purchase.pass.games.map((g) => g.game_id));
  const invalidIds = uniqueGameIds.filter((id) => !poolGameIds.has(id));
  if (invalidIds.length > 0) {
    return NextResponse.json(
      { error: `game_ids not in this pass's pool: ${invalidIds.join(', ')}` },
      { status: 400 }
    );
  }

  // ---- Selection-count validation ----
  if (uniqueGameIds.length !== purchase.pass.required_selection_count) {
    return NextResponse.json(
      {
        error: `Must select exactly ${purchase.pass.required_selection_count} games, got ${uniqueGameIds.length}`,
      },
      { status: 400 }
    );
  }

  // ---- Difficulty validation ----
  const requestedGames = await prisma.game.findMany({
    where: { id: { in: uniqueGameIds } },
    select: { id: true, difficulty: true },
  });
  const heavyCount = requestedGames.filter((g) => g.difficulty === GameDifficulty.HEAVY).length;
  if (heavyCount < purchase.pass.minimum_difficult_games_to_select) {
    return NextResponse.json(
      {
        error: `Must select at least ${purchase.pass.minimum_difficult_games_to_select} HEAVY games, got ${heavyCount}`,
      },
      { status: 400 }
    );
  }

  // ---- Diff against current selection ----
  const currentGameIds = new Set(purchase.selected_games.map((g) => g.game_id));
  const newGameIds = new Set(uniqueGameIds);

  const toRemove = [...currentGameIds].filter((id) => !newGameIds.has(id));
  const toAdd = [...newGameIds].filter((id) => !currentGameIds.has(id));

  if (toRemove.length === 0 && toAdd.length === 0) {
    return NextResponse.json({ message: 'No changes — selection is identical', game_ids: uniqueGameIds });
  }

  // Cheap pre-check for a friendlier error message before opening the
  // transaction. This is NOT the source of truth for correctness — two
  // concurrent requests could both pass this check for the same game.
  // The atomic conditional UPDATE inside the transaction below is what
  // actually prevents overbooking; this just avoids paying for a
  // transaction we can predict will likely fail.
  if (toAdd.length > 0) {
    const addTargets = await prisma.game.findMany({
      where: { id: { in: toAdd } },
      select: { id: true, current_booked_slots: true, max_slots: true },
    });
    const obviouslyFull = addTargets.filter((g) => g.current_booked_slots >= g.max_slots);
    if (obviouslyFull.length > 0) {
      return NextResponse.json(
        {
          error: `No free slots for game_ids: ${obviouslyFull.map((g) => g.id).join(', ')}`,
        },
        { status: 409 }
      );
    }
  }

  // ---- Deallocate + allocate atomically ----
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Release slots held by games being dropped from the selection.
      //    Floored at 0 defensively — should never go negative, but a
      //    WHERE guard costs nothing and keeps the invariant airtight.
      for (const gameId of toRemove) {
        await tx.$executeRaw`
          UPDATE games
          SET current_booked_slots = current_booked_slots - 1
          WHERE id = ${gameId} AND current_booked_slots > 0
        `;
      }

      // 2. Atomically claim a slot on each newly-added game. Each UPDATE
      //    is conditioned on current_booked_slots < max_slots in the same
      //    statement that increments it, so this can't race past
      //    capacity even under concurrent requests — matches the
      //    documented rule on Game.current_booked_slots in schema.prisma.
      //    Prisma resolves $executeRaw's UPDATE...WHERE column<column
      //    comparison fine since both columns live on the same row.
      for (const gameId of toAdd) {
        const affected = await tx.$executeRaw`
          UPDATE games
          SET current_booked_slots = current_booked_slots + 1
          WHERE id = ${gameId} AND current_booked_slots < max_slots
        `;
        if (affected === 0) {
          // Throwing inside the interactive transaction rolls back
          // everything done so far in this callback, including any
          // decrements from step 1 — so a failed add never leaves a
          // partially-applied swap behind.
          throw new SlotUnavailableError(gameId);
        }
      }

      // 3. Sync the selection rows to match the new set.
      if (toRemove.length > 0) {
        await tx.playerPassSelectedGameMapping.deleteMany({
          where: { player_pass_purchase_id: purchaseId, game_id: { in: toRemove } },
        });
      }
      if (toAdd.length > 0) {
        await tx.playerPassSelectedGameMapping.createMany({
          data: toAdd.map((game_id) => ({
            player_pass_purchase_id: purchaseId,
            game_id,
          })),
        });
      }
    });
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return NextResponse.json(
        { error: `Game ${err.gameId} filled up before the swap could complete — please retry` },
        { status: 409 }
      );
    }
    console.error(`Failed to update selected games for purchase ${purchaseId}:`, err);
    return NextResponse.json({ error: 'Failed to update selected games' }, { status: 500 });
  }

  return NextResponse.json({
    message: 'Selected games updated',
    purchase_id: purchaseId,
    game_ids: uniqueGameIds,
    added: toAdd,
    removed: toRemove,
  });
}