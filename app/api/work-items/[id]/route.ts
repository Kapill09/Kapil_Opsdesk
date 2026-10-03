import { NextRequest } from 'next/server';
import { WorkItemService } from '../../../../server/services/workItems';
import { updateWorkItemSchema } from '../../../../lib/validation';
import { handleAPIError, APIError } from '../../../../lib/errors';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const id = z.string().uuid().parse(paramId);
    const item = await WorkItemService.getById(id);
    if (!item) throw new APIError(404, 'Work item not found');
    
    return Response.json(item);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const id = z.string().uuid().parse(paramId);
    const body = await request.json();
    const data = updateWorkItemSchema.parse(body);

    // Mock actor ID
    const { db } = await import('../../../../lib/db');
    const firstUser = await db.query.users.findFirst();
    const actorId = firstUser ? firstUser.id : '00000000-0000-0000-0000-000000000000';

    const item = await WorkItemService.update(id, data, actorId);
    return Response.json(item);
  } catch (error) {
    return handleAPIError(error);
  }
}
