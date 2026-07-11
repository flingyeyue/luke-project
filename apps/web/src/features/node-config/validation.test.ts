import { describe, expect, it } from 'vitest';

import { validateNodeConfig } from './validation';

describe('validateNodeConfig', () => {
  it('returns parsed configuration for a valid node', () => {
    const result = validateNodeConfig('input.csv', {
      sourceId: 'orders',
      delimiter: 'auto',
      header: true,
      encoding: 'utf-8',
      skipEmptyLines: true,
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('returns a stable config field path', () => {
    const result = validateNodeConfig('input.csv', {
      sourceId: '',
      delimiter: 'auto',
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ path: 'config.sourceId' }),
    );
  });
});
