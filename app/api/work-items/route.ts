import { NextRequest } from 'next/server';
import { WorkItemService } from '../../../server/services/workItems';
import { createWorkItemSchema, paginationQuerySchema, workItemFilterSchema } from '../../../lib/validation';
import { handleAPIError } from '../../../lib/errors';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());
    
    // Default limit
    if (!query.limit) query.limit = '20';

    const pagination = paginationQuerySchema.parse(query);
    const filters = workItemFilterSchema.parse(query);

    const result = await WorkItemService.list({ ...pagination, ...filters });
    return Response.json(result);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createWorkItemSchema.parse(body);

    // Mock creator ID for now, since auth is in a later milestone
    const creatorId = '00000000-0000-0000-0000-000000000000'; // Assume a valid UUID or handle safely
    // Wait, the seed created random users. The database requires createdBy to reference users.id.
    // If we hardcode, it will violate FK constraint.
    // Let's fetch the first user as a fallback.
    const { db } = await import('../../../lib/db');
    const { users } = await import('../../../lib/db/schema');
    const firstUser = await db.query.users.findFirst();
    const actorId = firstUser ? firstUser.id : '00000000-0000-0000-0000-000000000000';

    const result = await WorkItemService.create(data, actorId);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
