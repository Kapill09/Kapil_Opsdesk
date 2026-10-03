import { NextRequest } from 'next/server';
import { CommentService } from '../../../../../server/services/comments';
import { createCommentSchema } from '../../../../../lib/validation';
import { handleAPIError, APIError } from '../../../../../lib/errors';
import { z } from 'zod';
import { getCurrentUser } from '../../../../../lib/auth';
import { AuthError } from '../../../../../lib/authorization';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const itemId = z.string().uuid().parse(paramId);
    const body = await request.json();
    const data = createCommentSchema.parse(body);

    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, 'Unauthorized');

    const comment = await CommentService.create(itemId, user, data);
    return Response.json(comment, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
