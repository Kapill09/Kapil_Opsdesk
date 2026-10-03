import { NextRequest } from 'next/server';
import { WorkItemService } from '../../../server/services/workItems';
import { createWorkItemSchema, paginationQuerySchema, workItemFilterSchema } from '../../../lib/validation';
import { handleAPIError } from '../../../lib/errors';
import { z } from 'zod';
import { getCurrentUser } from '../../../lib/auth';
import { AuthError } from '../../../lib/authorization';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());
    
    // Default limit
    if (!query.limit) query.limit = '20';

    const pagination = paginationQuerySchema.parse(query);
    const filters = workItemFilterSchema.parse(query);

    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, 'Unauthorized');

    const result = await WorkItemService.list({ ...pagination, ...filters }, user);
    return Response.json(result);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createWorkItemSchema.parse(body);

    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, 'Unauthorized');

    const result = await WorkItemService.create(data, user);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
