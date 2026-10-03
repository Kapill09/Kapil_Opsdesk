import { NextRequest } from 'next/server';
import { WorkItemService } from '../../../../server/services/workItems';
import { updateWorkItemSchema } from '../../../../lib/validation';
import { handleAPIError, APIError } from '../../../../lib/errors';
import { z } from 'zod';
import { getCurrentUser } from '../../../../lib/auth';
import { AuthError } from '../../../../lib/authorization';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const id = z.string().uuid().parse(paramId);
    
    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, 'Unauthorized');

    const item = await WorkItemService.getById(id, user);
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

    const idempotencyKey = request.headers.get('Idempotency-Key') || undefined;

    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, 'Unauthorized');

    const item = await WorkItemService.update(id, data, user, idempotencyKey);
    return Response.json(item);
  } catch (error) {
    return handleAPIError(error);
  }
}
