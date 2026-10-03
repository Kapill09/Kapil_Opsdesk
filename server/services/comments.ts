import { db } from '../../lib/db';
import { comments, itemEvents, workItems, outbox } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createCommentSchema } from '../../lib/validation';
import { APIError } from '../../lib/errors';
import { CurrentUser } from '../../lib/auth';
import { authorize } from '../../lib/authorization';

export class CommentService {
  static async create(itemId: string, user: CurrentUser, data: z.infer<typeof createCommentSchema>) {
    return await db.transaction(async (tx) => {
      // Validate work item exists
      const item = await tx.query.workItems.findFirst({ where: eq(workItems.id, itemId) });
      if (!item) throw new APIError(404, 'Work item not found');

      authorize(user, 'comment', { teamId: item.teamId });

      const [newComment] = await tx.insert(comments).values({
        itemId,
        authorId: user.id,
        content: data.content,
      }).returning();

      await tx.insert(itemEvents).values({
        itemId,
        actorId: user.id,
        type: 'comment_added',
        payload: { commentId: newComment.id },
      });

      await tx.insert(outbox).values({
        type: 'item_commented',
        payload: { itemId, commentId: newComment.id, actorId: user.id },
      });

      return newComment;
    });
  }
}
