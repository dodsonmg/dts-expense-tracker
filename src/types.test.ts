import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  ITEMIZED_CATEGORIES,
  hasPhoto,
  isEntered,
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
  entered: false,
  miles: null,
  rate: null,
  photoIds: [],
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

describe('isEntered', () => {
  it('is true only when entered is exactly true', () => {
    expect(isEntered({ ...exp(10, 12), entered: true })).toBe(true);
    expect(isEntered({ ...exp(10, 12), entered: false })).toBe(false);
  });

  it('treats a legacy row missing the field as not entered', () => {
    // Rows persisted before `entered` existed have no such field.
    const legacy = exp(10, 12) as Partial<Expense>;
    delete legacy.entered;
    expect(isEntered(legacy as Expense)).toBe(false);
  });
});

describe('hasPhoto', () => {
  it('is true only when at least one photo is attached', () => {
    expect(hasPhoto({ ...exp(10, 12), photoIds: ['p1'] })).toBe(true);
    expect(hasPhoto({ ...exp(10, 12), photoIds: [] })).toBe(false);
  });

  it('treats a legacy row missing the field as having no photo', () => {
    // Rows persisted before receipt photos existed have no such field.
    const legacy = exp(10, 12) as Partial<Expense>;
    delete legacy.photoIds;
    expect(hasPhoto(legacy as Expense)).toBe(false);
  });
});
