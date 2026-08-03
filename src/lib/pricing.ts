import type { Pass, PassOffer } from '@/generated/prisma';

export function computePassPricing(
  pass: Pass,
  offer: PassOffer | null,
  now: Date = new Date()
) {
  const isOfferActive =
    !!offer &&
    offer.is_active &&
    now >= offer.start_time &&
    now <= offer.end_time;

  const basePrice = pass.price;
  let savings = 0;
  let discountedPrice = basePrice;

  if (isOfferActive && offer) {
    // Compute whole number pricing math safely without decimal fragmentation
    savings = Math.round(basePrice * (offer.discount_percent.toNumber() / 100));
    discountedPrice = basePrice - savings;
  }

  return { basePrice, discountedPrice, savings, isOfferActive: !!isOfferActive };
}