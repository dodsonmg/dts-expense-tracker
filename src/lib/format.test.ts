import { describe, it, expect } from 'vitest';
import { slugify } from './format';

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
