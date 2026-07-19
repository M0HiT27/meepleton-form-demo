import { getAllPassesWithOffers } from './controller';

/**
 * GET /api/passes
 * Fetches all available gaming passes along with real-time active pricing details
 */
export async function GET() {
  return await getAllPassesWithOffers();
}