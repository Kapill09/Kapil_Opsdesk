import { NextRequest } from 'next/server';
import { getCurrentUser } from '../../../lib/auth';
import { AuthError } from '../../../lib/authorization';
import { handleAPIError } from '../../../lib/errors';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, 'Unauthorized');

    return Response.json(user.memberships);
  } catch (error) {
    return handleAPIError(error);
  }
}
