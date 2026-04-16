import { DURATION_OPTIONS } from './constants';

/**
 * Calculate total price based on selected duration keys and slot pricing.
 * @param {Object} slotPricing - e.g., { min20: 10, min30: 15, hr1: 30, ... }
 * @param {string[]} selectedKeys - e.g., ['hr1', 'min20']
 * @returns {{ totalMinutes: number, totalPrice: number, breakdown: Array }}
 */
export function calculatePrice(slotPricing, selectedKeys) {
  let totalMinutes = 0;
  let totalPrice = 0;
  const breakdown = [];

  for (const key of selectedKeys) {
    const option = DURATION_OPTIONS.find((d) => d.key === key);
    if (option && slotPricing[key] !== undefined) {
      totalMinutes += option.minutes;
      totalPrice += slotPricing[key];
      breakdown.push({
        label: option.label,
        price: slotPricing[key],
      });
    }
  }

  return { totalMinutes, totalPrice, breakdown };
}

/**
 * Get the per-minute rate for a slot
 */
export function getPerMinuteRate(slotPricing) {
  if (slotPricing?.min20) {
    return slotPricing.min20 / 20;
  }
  if (slotPricing?.hr1) {
    return slotPricing.hr1 / 60;
  }
  return 0.5; // fallback
}
