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

  console.log('🧹 Cleaned up old records.');

  // 2. Seed Board Games
  console.log('🎲 Seeding board games...');

  const catan = await prisma.game.create({
    data: {
      name: 'Catan',
      genre: 'Strategy',
      required_players: 3,
      max_slots: 4,
      estimated_runtime_minutes: 90,
      description: 'Trade, build, and settle your way to dominance on the isle of Catan.',
    }
  });

  const azul = await prisma.game.create({
    data: {
      name: 'Azul',
      genre: 'Abstract Strategy',
      required_players: 2,
      max_slots: 4,
      estimated_runtime_minutes: 45,
      description: 'Draft and place colorful tiles to build the most elegant mosaic wall.',
    }
  });

  const splendor = await prisma.game.create({
    data: {
      name: 'Splendor',
      genre: 'Card Development',
      required_players: 2,
      max_slots: 4,
      estimated_runtime_minutes: 30,
      description: 'Build a gem-trading empire by acquiring mines, transportation, and shops.',
    }
  });

  const ticketToRide = await prisma.game.create({
    data: {
      name: 'Ticket to Ride',
      genre: 'Strategy / Route Building',
      required_players: 2,
      max_slots: 5,
      estimated_runtime_minutes: 60,
      description: 'Claim railway routes across the map to connect cities and complete tickets.',
    }
  });

  const carcassonne = await prisma.game.create({
    data: {
      name: 'Carcassonne',
      genre: 'Tile-Placement',
      required_players: 2,
      max_slots: 5,
      estimated_runtime_minutes: 45,
      description: 'Lay tiles to build the medieval landscape and place followers to score regions.',
    }
  });

  const sevenwonders = await prisma.game.create({
    data: {
      name: '7 Wonders',
      genre: 'Card Drafting',
      required_players: 3,
      max_slots: 7,
      estimated_runtime_minutes: 45,
      description: 'Draft cards over three ages to develop your civilization and build a wonder.',
    }
  });

  // 3. Seed Pass Offers (Discounts)
  console.log('💸 Seeding pass offers...');

  const summerSale = await prisma.passOffer.create({
    data: {
      name: 'Summer Dice Festival 2026',
      discount_percent: 15,
      is_active: true,
      start_time: new Date('2026-06-01T00:00:00Z'),
      end_time: new Date('2026-08-31T23:59:59Z'),
    },
  });

  const tabletopDay = await prisma.passOffer.create({
    data: {
      name: 'International Tabletop Day Deal',
      discount_percent: 25,
      is_active: true,
      start_time: new Date('2026-04-01T00:00:00Z'),
      end_time: new Date('2026-05-01T23:59:59Z'),
    },
  });

  // 4. Seed Passes
  console.log('🎟️ Seeding board game passes...');

  // Strategy Pass: Linked to 4 heavy games, but player can only pick 2 to play
  const strategyPass = await prisma.pass.create({
    data: {
      name: 'Strategy Settler Pass',
      description: 'Choose any 2 premium strategy games from our elite collection of 4 titles.',
      required_selection_count: 2, // The limit of choices a player gets
      price: 30,
      start_time: new Date('2026-06-01T00:00:00Z'),
      end_time: new Date('2026-08-31T23:59:59Z'),
      pass_offer_id: summerSale.id,
    },
  });

  // Family Pass: Linked to all 6 games, player can pick 3 to play
  const casualPass = await prisma.pass.create({
    data: {
      name: 'Family Game Night Bundle',
      description: 'Ultimate flexibility! Choose any 3 games out of our entire catalog of 6 mainstream classics.',
      required_selection_count: 3, // The limit of choices a player gets
      price: 40,
      start_time: new Date('2026-04-01T00:00:00Z'),
      end_time: new Date('2026-05-01T23:59:59Z'),
      pass_offer_id: tabletopDay.id,
    },
  });

  // 5. Connect Games to Passes via the Explicit Join Table
  console.log('🔗 Mapping games to passes (Creating pools of choices)...');
  await prisma.gameToPassMapping.createMany({
    data: [
      // Strategy Pass Pool (4 games mapped, player gets to pick 2)
      { pass_id: strategyPass.id, game_id: catan.id },
      { pass_id: strategyPass.id, game_id: ticketToRide.id },
      { pass_id: strategyPass.id, game_id: sevenwonders.id },
      { pass_id: strategyPass.id, game_id: splendor.id },

      // Family Game Night Pool (All 6 games mapped, player gets to pick 3)
      { pass_id: casualPass.id, game_id: catan.id },
      { pass_id: casualPass.id, game_id: azul.id },
      { pass_id: casualPass.id, game_id: splendor.id },
      { pass_id: casualPass.id, game_id: ticketToRide.id },
      { pass_id: casualPass.id, game_id: carcassonne.id },
      { pass_id: casualPass.id, game_id: sevenwonders.id },
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