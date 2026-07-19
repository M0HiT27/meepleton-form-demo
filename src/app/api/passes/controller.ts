import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Aligned with your pooled singleton instance

export async function getAllPassesWithOffers() {
  try {
    // Fetch all passes, including their single optional offer and join-table games
    const passes = await prisma.pass.findMany({
      include: {
        pass_offer: true,
        games: {
          include: {
            game: true,
          },
        },
      },
    });

    // 1. Force the current system execution time into Asia/Kolkata timezone context
    const nowInKolkata = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
    );

    // Transform raw structural records into ready-to-consume frontend assets
    const formattedPasses = passes.map((pass) => {
      const offer = pass.pass_offer;
      
      // 2. Evaluate validity by parsing DB timestamps into the same target timezone context
      const offerStartTime = offer ? new Date(new Date(offer.start_time).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })) : null;
      const offerEndTime = offer ? new Date(new Date(offer.end_time).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })) : null;

      const isOfferActive = 
        offer && 
        offer.is_active && 
        offerStartTime && 
        offerEndTime &&
        nowInKolkata >= offerStartTime && 
        nowInKolkata <= offerEndTime;

      const basePrice = pass.price;
      let finalPrice = basePrice;
      let savings = 0;

      if (isOfferActive && offer) {
        // Compute whole number pricing math safely without decimal fragmentation
        savings = Math.round(basePrice * (offer.discount_percent / 100));
        finalPrice = basePrice - savings;
      }

      return {
        id: pass.id,
        name: pass.name,
        description: pass.description,
        requiredSelectionCount: pass.required_selection_count, // Renamed to match your schema change
        pricing: {
          basePrice: basePrice,
          discountedPrice: finalPrice,
          hasActiveDiscount: !!isOfferActive,
          discountPercent: isOfferActive && offer ? offer.discount_percent : 0,
          savings: savings,
          // Countdown metadata fields for frontend integration
          discountName: isOfferActive && offer ? offer.name : null,
          discountEndsAtMs: isOfferActive && offer ? new Date(offer.end_time).getTime() : null,
        },
        // Flatten the structural mapping array into a clean game list
        games: pass.games.map((mapping) => ({
          id: mapping.game.id,
          name: mapping.game.name,
          genre: mapping.game.genre,
          requiredPlayers: mapping.game.required_players,
          maxSlots: mapping.game.max_slots,
          estimatedRuntimeMinutes: mapping.game.estimated_runtime_minutes,
          current_booked_slots: mapping.game.current_booked_slots,
        })),
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