import { describe, it, expect } from 'vitest';
import { idSchema } from '../lib/validation';

describe('Validation', () => {
  it('validates a correct UUID', () => {
    const validId = '123e4567-e89b-12d3-a456-426614174000';
    const result = idSchema.safeParse({ id: validId });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid UUID', () => {
    const invalidId = 'not-a-uuid';
    const result = idSchema.safeParse({ id: invalidId });
    expect(result.success).toBe(false);
  });
});
