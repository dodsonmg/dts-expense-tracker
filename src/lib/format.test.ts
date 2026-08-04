import { describe, it, expect } from 'vitest';
import { money, slugify, FOREIGN_SYMBOL } from './format';

describe('money', () => {
  it('formats USD with a dollar sign', () => {
    expect(money(12.3, 'USD')).toBe('$12.30');
  });

  it('formats GBP with the foreign-currency symbol combo, not a dollar sign', () => {
    expect(money(12.3, 'GBP')).toBe(`${FOREIGN_SYMBOL}12.30`);
    expect(money(1234.5, 'GBP')).toBe(`${FOREIGN_SYMBOL}1,234.50`);
  });

  it('renders null as an em dash regardless of currency', () => {
    expect(money(null, 'USD')).toBe('—');
    expect(money(null, 'GBP')).toBe('—');
  });
});

describe('slugify', () => {
  it('lowercases and dashes a normal name', () => {
    expect(slugify('London Aug 2026')).toBe('london-aug-2026');
  });

  it('collapses runs of punctuation into a single dash', () => {
    expect(slugify('Ramstein--Sep!! 2026')).toBe('ramstein-sep-2026');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('  -Trip- ')).toBe('trip');
  });

  it('falls back to "trip" for an empty name', () => {
    expect(slugify('')).toBe('trip');
  });

  it('falls back to "trip" for an all-punctuation/non-Latin name', () => {
    expect(slugify('!!!')).toBe('trip');
    expect(slugify('東京')).toBe('trip');
  });
});
