import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Aligned with your pooled singleton instance
import { computePassPricing } from '@/lib/pricing';

export async function getPassById(idString: string) {
  try {
    const passId = parseInt(idString, 10);

    if (isNaN(passId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid pass ID format' },
        { status: 400 }
      );
    }

    // Fetch a single pass, including its single optional offer, join-table
    // games, and its single optional kit (with the kit's items resolved
    // through the join table)
    const pass = await prisma.pass.findUnique({
      where: { id: passId },
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

    if (!pass) {
      return NextResponse.json(
        { success: false, error: 'Pass not found' },
        { status: 404 }
      );
    }

    const now = new Date();

    // NOTE: Date objects represent an absolute instant (epoch value), not a
    // wall-clock time — comparing them directly is already timezone-correct.
    // No need to round-trip through Asia/Kolkata locale strings; that was
    // both unnecessary and unreliable (locale-string re-parsing isn't
    // guaranteed to behave consistently across Node/browser environments).
    const isPassActive = now >= pass.start_time && now <= pass.end_time;

    const offer = pass.pass_offer;

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

    // Construct unified payload structure matching your exact output keys
    const formattedPass = {
      id: pass.id,
      name: pass.name,
      description: pass.description,
      requiredSelectionCount: pass.required_selection_count,
      minimumDifficultGamesToSelect: pass.minimum_difficult_games_to_select,
      // Unlike the list endpoint (which filters inactive passes out of the
      // result set entirely), a direct by-id fetch can still be hit via a
      // stale/shared/bookmarked link after the pass's window has closed.
      // Surface that explicitly rather than silently serving stale pricing,
      // and let the caller decide whether to block purchase, show a
      // "no longer available" state, etc.
      isActive: isPassActive,
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
      // A pass may or may not have a kit attached; null when it doesn't.
      // Flatten the join-table rows into a clean item list, same pattern
      // as `games` above.
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

    return NextResponse.json({ success: true, data: formattedPass }, { status: 200 });
  } catch (error) {
    console.error(`❌ Failed to fetch pass ${idString}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}