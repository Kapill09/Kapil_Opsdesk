import { NextRequest } from 'next/server';
import { CommentService } from '../../../../../server/services/comments';
import { createCommentSchema } from '../../../../../lib/validation';
import { handleAPIError, APIError } from '../../../../../lib/errors';
import { z } from 'zod';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const itemId = z.string().uuid().parse(paramId);
    const body = await request.json();
    const data = createCommentSchema.parse(body);

    // Mock actor ID
    const { db } = await import('../../../../../lib/db');
    const firstUser = await db.query.users.findFirst();
    const actorId = firstUser ? firstUser.id : '00000000-0000-0000-0000-000000000000';

    const comment = await CommentService.create(itemId, actorId, data);
    return Response.json(comment, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
