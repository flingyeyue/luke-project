import { afterEach, describe, expect, it, vi } from 'vitest';

import { createId } from './create-id';

describe('createId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when it is available', () => {
    const randomUUID = vi.fn(() => '00000000-0000-4000-8000-000000000001');
    vi.stubGlobal('crypto', { randomUUID });

    expect(createId()).toBe('00000000-0000-4000-8000-000000000001');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('generates a UUID v4 when randomUUID is unavailable', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.set(Array.from({ length: 16 }, (_, index) => index));
      return bytes;
    });
    vi.stubGlobal('crypto', { getRandomValues });

    expect(createId()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(getRandomValues).toHaveBeenCalledOnce();
  });
});
