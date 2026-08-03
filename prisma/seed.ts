import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting board game database seeding...');

  // 1. Clean out existing data to ensure a fresh, predictable seed state
  // Deleting in reverse order of dependencies to protect relational integrity.
  // NOTE: Player model no longer exists (contact info now lives directly on
  // PlayerPassPurchase), so there's nothing to clean up there anymore.
  await prisma.playerPassSelectedGameMapping.deleteMany({});
  await prisma.gameToPassMapping.deleteMany({});
  await prisma.playerPassPurchase.deleteMany({});
  await prisma.pass.deleteMany({});
  await prisma.passOffer.deleteMany({});
  await prisma.game.deleteMany({});
  await prisma.transaction.deleteMany({});
  // Kit tables — deleted after Pass so the kit_id FK (onDelete: SetNull)
  // on Pass has nothing left pointing at these rows anyway.
  await prisma.kitToKitItemMapping.deleteMany({});
  await prisma.kit.deleteMany({});
  await prisma.kitItem.deleteMany({});

  console.log('🧹 Cleaned up old records.');

  // 2. Seed Board Games
  // Sourced from the updated Game_List_-_games.csv. A few games were
  // renamed / re-sized by the new list — mapped 1:1 by CSV row position
  // against the previous seed:
  //   Trio              -> Sequence (Solo)          (max_slots 40 -> 60)
  //   Exploding Kittens  -> Exploding Minions         (max_slots 40 -> 60)
  //   Sequence           -> Next Station : London     (unchanged sizing)
  //   UNO max_slots 40 -> 60
  console.log('🎲 Seeding board games...');

  const uno = await prisma.game.create({
    data: {
      name: 'UNO',
      genre: 'Party Game',
      required_players: 10,
      max_slots: 60,
      estimated_runtime_minutes: 30,
      description: 'Match colors and numbers, dodge Draw Fours, and be first to empty your hand.',
    }
  });

  const anomia = await prisma.game.create({
    data: {
      name: 'Anomia',
      genre: 'Party Game',
      required_players: 6,
      max_slots: 40,
      estimated_runtime_minutes: 20,
      description: 'Fast-paced matching game where quick reflexes and quicker answers win the round.',
    }
  });

  const sequenceSolo = await prisma.game.create({
    data: {
      name: 'Sequence (Solo)',
      genre: 'Party Game',
      required_players: 6,
      max_slots: 60,
      estimated_runtime_minutes: 20,
      description: 'Guess the answer before your opponents in this rapid-fire card guessing game.',
    }
  });

  const explodingMinions = await prisma.game.create({
    data: {
      name: 'Exploding Minions',
      genre: 'Party Game',
      required_players: 5,
      max_slots: 60,
      estimated_runtime_minutes: 15,
      description: 'A card game of chance and strategy — avoid the exploding kitten, or defuse it in time.',
    }
  });

  const nextStationLondon = await prisma.game.create({
    data: {
      name: 'Next Station : London',
      genre: 'Strategy',
      required_players: 12,
      max_slots: 40,
      estimated_runtime_minutes: 45,
      description: 'Blend cards and board play to form a sequence of five chips before your rivals.',
    }
  });

  const splendor = await prisma.game.create({
    data: {
      name: 'Splendor',
      genre: 'Strategy',
      required_players: 4,
      max_slots: 40,
      estimated_runtime_minutes: 30,
      description: 'Collect gems, build your merchant empire, and outpace rival traders.',
    }
  });

  const azul = await prisma.game.create({
    data: {
      name: 'Azul',
      genre: 'Euro Game',
      required_players: 4,
      max_slots: 40,
      estimated_runtime_minutes: 45,
      description: 'Draft glowing tiles to craft the most elegant palace wall in the realm.',
    }
  });

  const catan = await prisma.game.create({
    data: {
      name: 'Catan',
      genre: 'Euro Game',
      required_players: 4,
      max_slots: 40,
      estimated_runtime_minutes: 90,
      description: 'Trade, build and settle your way to the largest empire on the island.',
    }
  });

  const cascadia = await prisma.game.create({
    data: {
      name: 'Cascadia',
      genre: 'Euro Game',
      required_players: 4,
      max_slots: 40,
      estimated_runtime_minutes: 45,
      description: 'Lay habitat tiles and place wildlife to build the most harmonious nature reserve.',
    }
  });

  const wingspan = await prisma.game.create({
    data: {
      name: 'Wingspan',
      genre: 'Euro Game',
      required_players: 5,
      max_slots: 40,
      estimated_runtime_minutes: 70,
      description: 'Attract birds to your wildlife preserves in this beautifully engine-building game.',
    }
  });

  const sevenWonders = await prisma.game.create({
    data: {
      name: '7 Wonders',
      genre: 'Strategy',
      required_players: 7,
      max_slots: 40,
      estimated_runtime_minutes: 45,
      description: 'Draft cards across three ages to build a civilization that stands the test of time.',
    }
  });

  const cryptid = await prisma.game.create({
    data: {
      name: 'Cryptid',
      genre: 'Social Deduction',
      required_players: 5,
      max_slots: 40,
      estimated_runtime_minutes: 50,
      description: 'Use logic and sly deduction to be the first to pinpoint the creature\'s hidden location.',
    }
  });

  const heat = await prisma.game.create({
    data: {
      name: 'Heat: Pedal to the Metal',
      genre: 'Strategy',
      required_players: 6,
      max_slots: 40,
      estimated_runtime_minutes: 75,
      description: 'Race, draft gears, and manage your engine heat to cross the finish line first.',
    }
  });

  const everdell = await prisma.game.create({
    data: {
      name: 'Everdell',
      genre: 'Euro Game',
      required_players: 4,
      max_slots: 40,
      estimated_runtime_minutes: 80,
      description: 'Build a woodland city of critters and constructions across four charming seasons.',
    }
  });

  const castlesOfBurgundy = await prisma.game.create({
    data: {
      name: 'Castles Of Burgundy',
      genre: 'Euro Game',
      required_players: 4,
      max_slots: 40,
      estimated_runtime_minutes: 90,
      description: 'Roll, place, and build your way to the most prosperous estate in Burgundy.',
    }
  });

  const brassBirmingham = await prisma.game.create({
    data: {
      name: 'Brass Birmingham',
      genre: 'Strategy',
      required_players: 4,
      max_slots: 40,
      estimated_runtime_minutes: 120,
      description: 'Build industries and networks across two eras of the Industrial Revolution.',
    }
  });

  const botc = await prisma.game.create({
    data: {
      name: 'Blood on the Clocktower',
      genre: 'Social Deduction',
      required_players: 15,
      max_slots: 40,
      estimated_runtime_minutes: 120,
      description: 'A narrator-led social deduction game of secret roles, bluffing, and nightly murder.',
    }
  });

  // 3. Seed Pass Offers (Discounts)
  // Each pass now gets its own dedicated early-bird offer, all running
  // through Aug 9 2026 11:59 PM IST (converted to UTC: IST is UTC+5:30,
  // so 23:59 IST == 18:29 UTC, same calendar date).
  console.log('💸 Seeding pass offers...');

  const earlyBirdEnd = new Date('2026-08-09T18:29:00Z');
  const earlyBirdStart = new Date('2026-01-01T00:00:00Z');

  const explorerEarlyBirdOffer = await prisma.passOffer.create({
    data: {
      name: 'Explorer Early Bird',
      discount_percent: 25,
      is_active: true,
      start_time: earlyBirdStart,
      end_time: earlyBirdEnd,
    },
  });

  const leagueEarlyBirdOffer = await prisma.passOffer.create({
    data: {
      name: 'League Early Bird',
      discount_percent: 13.34,
      is_active: true,
      start_time: earlyBirdStart,
      end_time: earlyBirdEnd,
    },
  });

  const botcEarlyBirdOffer = await prisma.passOffer.create({
    data: {
      name: 'Blood on the Clocktower Early Bird',
      discount_percent: 11.1,
      is_active: true,
      start_time: earlyBirdStart,
      end_time: earlyBirdEnd,
    },
  });

  // 4. Seed Kits (must exist before Passes, since Pass.kit_id points at Kit)
  console.log('🎁 Seeding kits and kit items...');

  const toteBag = await prisma.kitItem.create({ data: { item_name: 'Tote Bag' } });
  const stickers = await prisma.kitItem.create({ data: { item_name: 'Stickers' } });
  const leagueShirt = await prisma.kitItem.create({ data: { item_name: 'League Shirt' } });
  const goodies = await prisma.kitItem.create({ data: { item_name: 'Goodies' } });

  const regularKit = await prisma.kit.create({ data: { kit_name: 'Regular' } });
  const premiumKit = await prisma.kit.create({ data: { kit_name: 'Premium' } });

  await prisma.kitToKitItemMapping.createMany({
    data: [
      // Regular kit: Tote Bag, Stickers — comes with Explorer & BOTC passes
      { kit_id: regularKit.id, kit_item_id: toteBag.id },
      { kit_id: regularKit.id, kit_item_id: stickers.id },

      // Premium kit: Tote Bag, Stickers, League Shirt, Goodies — comes with League pass
      { kit_id: premiumKit.id, kit_item_id: toteBag.id },
      { kit_id: premiumKit.id, kit_item_id: stickers.id },
      { kit_id: premiumKit.id, kit_item_id: leagueShirt.id },
      { kit_id: premiumKit.id, kit_item_id: goodies.id },
    ],
  });

  // 5. Seed Passes
  // Pricing unchanged from the previous seed.
  console.log('🎟️ Seeding board game passes...');

  const explorerPass = await prisma.pass.create({
    data: {
      name: 'Explorer Pass',
      description: 'Choose any 1 game from our full lineup — perfect for a single-game deep dive.',
      required_selection_count: 1,
      price: 399,
      start_time: earlyBirdStart,
      end_time: earlyBirdEnd,
      pass_offer_id: explorerEarlyBirdOffer.id,
      kit_id: regularKit.id,
    },
  });

  const leaguePass = await prisma.pass.create({
    data: {
      name: 'League Pass',
      description: 'Full access to the league stage — select exactly 7 games to compete across.',
      required_selection_count: 7,
      price: 1499,
      start_time: earlyBirdStart,
      end_time: earlyBirdEnd,
      pass_offer_id: leagueEarlyBirdOffer.id,
      kit_id: premiumKit.id,
    },
  });

  const botcPass = await prisma.pass.create({
    data: {
      name: 'Blood on the Clocktower Pass',
      description: 'Full access to a single narrator-led Blood on the Clocktower session.',
      required_selection_count: 1,
      price: 899,
      start_time: earlyBirdStart,
      end_time: earlyBirdEnd,
      pass_offer_id: botcEarlyBirdOffer.id,
      kit_id: regularKit.id,
    },
  });

  // 6. Connect Games to Passes via the Explicit Join Table
  console.log('🔗 Mapping games to passes (Creating pools of choices)...');

  // Every game except Blood on the Clocktower is in the Explorer/League pool
  const generalPoolGames = [
    uno, anomia, sequenceSolo, explodingMinions, nextStationLondon, splendor,
    azul, catan, cascadia, wingspan, sevenWonders, cryptid, heat, everdell,
    castlesOfBurgundy, brassBirmingham,
  ];

  await prisma.gameToPassMapping.createMany({
    data: [
      // Explorer Pass pool (16 games, player picks 1)
      ...generalPoolGames.map((game) => ({ pass_id: explorerPass.id, game_id: game.id })),

      // League Pass pool (same 16 games, player picks 7)
      ...generalPoolGames.map((game) => ({ pass_id: leaguePass.id, game_id: game.id })),

      // Blood on the Clocktower Pass — its own dedicated pool
      { pass_id: botcPass.id, game_id: botc.id },
    ]
  });

  console.log('✨ Board game seeding successfully completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });