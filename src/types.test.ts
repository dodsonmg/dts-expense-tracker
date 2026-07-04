import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  ITEMIZED_CATEGORIES,
  isUsdPending,
  type Expense,
} from './types';

const exp = (gbp: number | null, usd: number | null): Expense => ({
  id: 'e',
  date: '2026-07-01',
  category: 'LODGING',
  amount_gbp: gbp,
  amount_usd: usd,
  payment: 'GTCC',
  note: '',
});

describe('categories', () => {
  it('excludes M&IE from itemized entry but keeps order otherwise', () => {
    expect(ITEMIZED_CATEGORIES).not.toContain('M&IE');
    expect(ITEMIZED_CATEGORIES).toEqual(
      CATEGORIES.filter((c) => c !== 'M&IE'),
    );
  });
});

describe('isUsdPending', () => {
  it('is true when GBP is present and USD is missing', () => {
    expect(isUsdPending(exp(50, null))).toBe(true);
  });

  it('is false once USD is filled in', () => {
    expect(isUsdPending(exp(50, 62))).toBe(false);
  });

  it('is false when there is no GBP amount', () => {
    expect(isUsdPending(exp(null, 62))).toBe(false);
    expect(isUsdPending(exp(null, null))).toBe(false);
  });

  it('treats zero GBP as a real amount, not missing', () => {
    expect(isUsdPending(exp(0, null))).toBe(true);
  });
});
