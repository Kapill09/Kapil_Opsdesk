import { NextRequest } from 'next/server';
import { db } from '../../../../../lib/db';
import { itemEvents } from '../../../../../lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { handleAPIError, APIError } from '../../../../../lib/errors';
import { z } from 'zod';
import { getCurrentUser } from '../../../../../lib/auth';
import { AuthError } from '../../../../../lib/authorization';
import { WorkItemService } from '../../../../../server/services/workItems';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const id = z.string().uuid().parse(paramId);

    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, 'Unauthorized');

    // Authorize by fetching item
    const item = await WorkItemService.getById(id, user);
    if (!item) throw new APIError(404, 'Work item not found');

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
