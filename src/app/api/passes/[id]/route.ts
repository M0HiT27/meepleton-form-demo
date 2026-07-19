import { getPassById } from './controller';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/passes/[id]
 * Resolves a singular ticket pass asset with full relational metrics
 */
export async function GET(request: Request, { params }: RouteParams) {
  const resolvedParams = await params;
  return await getPassById(resolvedParams.id);
}