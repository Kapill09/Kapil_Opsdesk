import { handleAPIError } from '../../../../../lib/errors';
import { z } from 'zod';
import { getCurrentUser } from '../../../../../lib/auth';
import { AuthError } from '../../../../../lib/authorization';
import { WorkItemService } from '../../../../../server/services/workItems';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const id = z.string().uuid().parse(params.id);

    const idempotencyKey = request.headers.get('Idempotency-Key') || undefined;

    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, 'Unauthorized');

    const result = await WorkItemService.claim(id, user, idempotencyKey);
    return Response.json(result);
  } catch (error) {
    return handleAPIError(error);
  }
}
