import { DURATION_OPTIONS } from './constants';

/**
 * Get the per-minute rate for a slot (used as fallback for unpriced durations)
 */
export function getPerMinuteRate(slotPricing) {
  if (slotPricing?.min20) return slotPricing.min20 / 20;
  if (slotPricing?.hr1) return slotPricing.hr1 / 60;
  return 0.5; // fallback ₹0.50/min
}

/**
 * Calculate total price based on selected duration keys and slot pricing.
 * Falls back to per-minute rate for keys not explicitly set (e.g. min1).
 * @param {Object} slotPricing - e.g., { min20: 10, min30: 15, hr1: 30, ... }
 * @param {string[]} selectedKeys - e.g., ['min1', 'hr1']
 * @returns {{ totalMinutes: number, totalPrice: number, breakdown: Array }}
 */
export function calculatePrice(slotPricing, selectedKeys) {
  let totalMinutes = 0;
  let totalPrice = 0;
  const breakdown = [];

  for (const key of selectedKeys) {
    const option = DURATION_OPTIONS.find((d) => d.key === key);
    if (!option) continue;

    let price;
    if (slotPricing[key] !== undefined) {
      // Slot owner explicitly set this tier price
      price = slotPricing[key];
    } else {
      // Derive from per-minute rate (handles min1 for old slots without it)
      const perMin = getPerMinuteRate(slotPricing);
      price = Math.max(1, Math.round(perMin * option.minutes));
    }

    totalMinutes += option.minutes;
    totalPrice += price;
    breakdown.push({ label: option.label, price });
  }

  return { totalMinutes, totalPrice, breakdown };
}
