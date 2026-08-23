import { requireAuth } from "@/lib/auth";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GameDifficulty } from '@/generated/prisma';
import { toUtcForDb } from "@/lib/timezone-converter";

interface CreatePassBody {
  game_ids: number[];
  name: string;
  description: string;
  required_selection_count: number; // player must choose exactly this many games from the pool
  minimum_difficult_games_to_select: number; // player must choose at least this many "heavy" games from the pool
  price: number; // stored as smallest whole unit deliberately, no decimals
  template_id?: number | null;
  start_time: string; // ISO date string from JSON
  end_time: string;
  num_people?: number;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;

  let body: CreatePassBody;
  try {
    body = (await req.json()) as CreatePassBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let {
    name,
    description,
    price,
    required_selection_count,
    minimum_difficult_games_to_select,
    template_id,
    start_time,
    end_time,
    game_ids,
    num_people = 1,
  } = body;
  
  // ---- Basic shape validation ----
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!description || typeof description !== 'string') {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }
  if (!Array.isArray(game_ids) || game_ids.length === 0) {
    return NextResponse.json({ error: 'game_ids must be a non-empty array' }, { status: 400 });
  }
  if (!Number.isInteger(price) || price < 0) {
    return NextResponse.json({ error: 'price must be a non-negative integer' }, { status: 400 });
  }
  if (!Number.isInteger(required_selection_count) || required_selection_count <= 0) {
    return NextResponse.json({ error: 'required_selection_count must be a positive integer' }, { status: 400 });
  }
  if (
    minimum_difficult_games_to_select != null &&
    (!Number.isInteger(minimum_difficult_games_to_select) || minimum_difficult_games_to_select < 0)
  ) {
    return NextResponse.json({ error: 'minimum_difficult_games_to_select must be a non-negative integer' }, { status: 400 });
  }
  if (minimum_difficult_games_to_select > required_selection_count) {
    return NextResponse.json(
      { error: 'minimum_difficult_games_to_select cannot exceed required_selection_count' },
      { status: 400 }
    );
  }
  if (!Number.isInteger(num_people) || num_people <= 0) {
    return NextResponse.json({ error: 'num_people must be a positive integer' }, { status: 400 });
  }

  let start = toUtcForDb(start_time);
  let end = toUtcForDb(end_time);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'start_time/end_time must be valid dates' }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json({ error: 'end_time must be after start_time' }, { status: 400 });
  }

  // De-dupe game_ids defensively — the pool a player picks from shouldn't
  // silently include the same game twice.
  const uniqueGameIds = Array.from(new Set(game_ids));
  if (uniqueGameIds.length !== game_ids.length) {
    return NextResponse.json({ error: 'game_ids contains duplicates' }, { status: 400 });
  }
  if (required_selection_count > uniqueGameIds.length) {
    return NextResponse.json(
      { error: 'required_selection_count cannot exceed the number of games in the pool' },
      { status: 400 }
    );
  }

  // ---- Referential validation ----
  const games = await prisma.game.findMany({
    where: { id: { in: uniqueGameIds } },
    select: { id: true, difficulty: true },
  });

  if (games.length !== uniqueGameIds.length) {
    const foundIds = new Set(games.map((g) => g.id));
    const missing = uniqueGameIds.filter((id) => !foundIds.has(id));
    return NextResponse.json({ error: `Unknown game_ids: ${missing.join(', ')}` }, { status: 400 });
  }

  // The minimum-heavy-games constraint only makes sense if the pool
  // actually contains enough HEAVY games to satisfy it.
  const heavyGameCount = games.filter((g) => g.difficulty === GameDifficulty.HEAVY).length;
  if (minimum_difficult_games_to_select > heavyGameCount) {
    return NextResponse.json(
      {
        error: `minimum_difficult_games_to_select (${minimum_difficult_games_to_select}) exceeds the number of HEAVY games in the pool (${heavyGameCount})`,
      },
      { status: 400 }
    );
  }

  if (template_id != null) {
    const templateExists = await prisma.pass.findUnique({ where: { id: template_id }, select: { id: true } });
    if (!templateExists) {
      return NextResponse.json({ error: `template_id ${template_id} does not exist` }, { status: 400 });
    }
  }

  // ---- Create pass + game mappings in a transaction ----
  try {
    const pass = await prisma.$transaction(async (tx) => {
      const created = await tx.pass.create({
        data: {
          name,
          description,
          price,
          required_selection_count,
          minimum_difficult_games_to_select: minimum_difficult_games_to_select ?? 0,
          template_id: template_id ?? null,
          start_time: start,
          end_time: end,
          num_people,
        },
      });

      await tx.gameToPassMapping.createMany({
        data: uniqueGameIds.map((game_id) => ({
          game_id,
          pass_id: created.id,
        })),
      });

      return created;
    });

    return NextResponse.json(pass, { status: 201 });
  } catch (err) {
    // name is @unique on Pass — surface that clearly instead of a raw 500
    if (err instanceof Error && 'code' in err && (err as any).code === 'P2002') {
      return NextResponse.json({ error: 'A pass with this name already exists' }, { status: 409 });
    }
    console.error('Failed to create pass:', err);
    return NextResponse.json({ error: 'Failed to create pass' }, { status: 500 });
  }
}