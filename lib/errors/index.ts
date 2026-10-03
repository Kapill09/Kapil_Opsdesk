import { z } from 'zod';
import { AuthError } from '../authorization';

export class APIError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

export function handleAPIError(error: unknown) {
  console.error('[API Error]:', error);

  if (error instanceof z.ZodError) {
    return Response.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
  }

  if (error instanceof APIError) {
    return Response.json({ error: error.message }, { status: error.statusCode });
  }

  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.statusCode });
  }

  // Generic fallback
  return Response.json({ error: 'Internal Server Error' }, { status: 500 });
}
