// Mileage calculator: an input convenience for the MILEAGE category. Unlike
// M&IE, each leg is its own itemized Expense (see SPEC.md § MILEAGE) — this
// just computes the USD amount from miles * rate so the office/DTS comparison
// still works entry-by-entry.
export function mileageAmountUsd(miles: number, rate: number): number {
  return Math.round(miles * rate * 100) / 100;
}

// Rate is kept to 3dp (GSA/DTS POV rates are sometimes e.g. $0.655/mile) so
// the List row shows exactly what was entered, unlike `money()` which always
// rounds display to 2dp.
export function describeMileage(miles: number, rate: number): string {
  return `${miles.toFixed(1)} mi @ $${rate.toFixed(3)}/mi`;
}
