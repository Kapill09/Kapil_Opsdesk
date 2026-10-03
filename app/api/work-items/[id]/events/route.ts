import { NextRequest } from 'next/server';
import { db } from '../../../../../lib/db';
import { itemEvents } from '../../../../../lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { handleAPIError } from '../../../../../lib/errors';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const id = z.string().uuid().parse(paramId);

    // Simplistic fetch of events
    const events = await db.query.itemEvents.findMany({
      where: eq(itemEvents.itemId, id),
      orderBy: [desc(itemEvents.createdAt)],
    });

    return Response.json(events);
  } catch (error) {
    return handleAPIError(error);
  }
}
