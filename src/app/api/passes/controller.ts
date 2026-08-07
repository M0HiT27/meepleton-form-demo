import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Aligned with your pooled singleton instance
import { computePassPricing } from '@/lib/pricing';

export async function getAllPassesWithOffers() {
  try {
    const now = new Date();

    // Fetch only passes that are currently within their own active window.
    // Pass.start_time / end_time define when the pass itself is purchasable —
    // this was missing entirely before (only the offer's window was checked).
    const passes = await prisma.pass.findMany({
      where: {
        start_time: { lte: now },
        end_time: { gte: now },
      },
      include: {
        pass_offer: true,
        games: {
          orderBy: {
            game: {
              difficulty: 'asc',
            },
          },
          include: {
            game: true,
          },
        },
        kit: {
          include: {
            items: {
              include: {
                item: true,
              },
            },
          },
        },
      },
    });

    // Transform raw structural records into ready-to-consume frontend assets
    const formattedPasses = passes.map((pass) => {
      const offer = pass.pass_offer;

      // NOTE: Date objects represent an absolute instant (epoch value), not a
      // wall-clock time — comparing them directly is already timezone-correct.
      // There's no need to round-trip through Asia/Kolkata locale strings; doing
      // so was both unnecessary and unreliable (locale-string re-parsing is not
      // guaranteed to behave consistently across Node/browser environments).
      const isOfferActive =
        !!offer &&
        offer.is_active &&
        now >= offer.start_time &&
        now <= offer.end_time;

      const basePrice = pass.price;
      let finalPrice = basePrice;
      let savings = 0;

      if (isOfferActive && offer) {
        // Compute whole number pricing math safely without decimal fragmentation
        const result = computePassPricing(pass, offer, now);

        finalPrice = result.discountedPrice;
        savings = result.savings;
      }

      return {
        id: pass.id,
        name: pass.name,
        description: pass.description,
        requiredSelectionCount: pass.required_selection_count,
        minimumDifficultGamesToSelect: pass.minimum_difficult_games_to_select,
        pricing: {
          basePrice: basePrice,
          discountedPrice: finalPrice,
          hasActiveDiscount: !!isOfferActive,
          discountPercent: isOfferActive && offer ? offer.discount_percent : 0,
          savings: savings,
          // Countdown metadata fields for frontend integration
          discountName: isOfferActive && offer ? offer.name : null,
          discountEndsAtMs: isOfferActive && offer ? offer.end_time.getTime() : null,
        },
        // Flatten the structural mapping array into a clean game list
        games: pass.games.map((mapping) => {
          const { max_slots, current_booked_slots } = mapping.game;

          return {
            id: mapping.game.id,
            name: mapping.game.name,
            genre: mapping.game.genre,
            difficulty: mapping.game.difficulty,
            requiredPlayers: mapping.game.required_players,
            maxSlots: max_slots,
            estimatedRuntimeMinutes: mapping.game.estimated_runtime_minutes,
            // current_booked_slots is incremented at RESERVATION time (i.e. as
            // soon as a PlayerPassPurchase is created, status PENDING), not at
            // payment confirmation — so it already accounts for in-flight
            // pending payments, not just CONFIRMED ones. Do not "fix" this to
            // exclude pending purchases; that would reopen the overbooking race
            // the reservation flow was built to close.
            currentBookedSlots: current_booked_slots,
            availableSlots: Math.max(0, max_slots - current_booked_slots),
          };
        }),
        kit: pass.kit
        ? {
            id: pass.kit.id,
            name: pass.kit.kit_name,
            items: pass.kit.items.map((mapping) => ({
              id: mapping.item.id,
              name: mapping.item.item_name,
            })),
          }
        : null,
      };
    });

    return NextResponse.json({ success: true, data: formattedPasses }, { status: 200 });
  } catch (error) {
    console.error('❌ Failed to fetch passes:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}