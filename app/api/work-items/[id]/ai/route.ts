import { NextRequest } from 'next/server';
import { z } from 'zod';
import { opsAiQuestionSchema } from '../../../../../lib/validation';
import { handleAPIError } from '../../../../../lib/errors';
import { getCurrentUser } from '../../../../../lib/auth';
import { AuthError } from '../../../../../lib/authorization';
import { askOpsAi } from '../../../../../server/services/opsAi';
import { LLMProviderError } from '../../../../../server/ai/provider';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const id = z.string().uuid().parse(paramId);

    const body = await request.json();
    const { question } = opsAiQuestionSchema.parse(body);

    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, 'Unauthorized');

    const result = await askOpsAi(id, question, user);

    return Response.json(result);
  } catch (error) {
    // Map LLM-specific errors to safe user-facing responses
    if (error instanceof LLMProviderError) {
      return Response.json(
        { error: { code: 'AI_UNAVAILABLE', message: error.message } },
        { status: error.statusCode },
      );
    }
    return handleAPIError(error);
  }
}
