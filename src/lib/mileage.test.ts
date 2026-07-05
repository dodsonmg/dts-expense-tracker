import { describe, it, expect } from 'vitest';
import { mileageAmountUsd, describeMileage } from './mileage';

describe('mileageAmountUsd', () => {
  it('multiplies miles by the USD/mile rate', () => {
    expect(mileageAmountUsd(42, 0.67)).toBe(28.14);
  });

  it('is zero when either input is zero', () => {
    expect(mileageAmountUsd(0, 0.67)).toBe(0);
    expect(mileageAmountUsd(42, 0)).toBe(0);
  });

  it('rounds to the nearest cent', () => {
    expect(mileageAmountUsd(12.3, 0.655)).toBe(8.06); // 8.0565 -> 8.06
  });
});

describe('describeMileage', () => {
  it('formats miles to 1dp and rate to 3dp, unlike money() which rounds to 2dp', () => {
    expect(describeMileage(42, 0.67)).toBe('42.0 mi @ $0.670/mi');
    expect(describeMileage(12.3, 0.655)).toBe('12.3 mi @ $0.655/mi');
  });
});
