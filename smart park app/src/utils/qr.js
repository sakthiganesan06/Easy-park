export function createSlotQrPayload(slotId, qrToken) {
  return JSON.stringify({
    app: 'easypark',
    slotId,
    qrToken,
  });
}

export function parseSlotQrPayload(raw) {
  if (!raw) return null;
  const text = String(raw).trim();

  if (text.startsWith('easypark:slot:')) {
    const slotId = text.replace('easypark:slot:', '').trim();
    return slotId ? { slotId, qrToken: null } : null;
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed?.app !== 'easypark' || !parsed?.slotId) return null;
    return { slotId: parsed.slotId, qrToken: parsed.qrToken || null };
  } catch {
    return null;
  }
}

/** Payload string for a DB row (snake_case or camel qr token). */
export function slotRowQrPayload(row) {
  const id = row?.id;
  if (!id) return '';
  const token = row?.qr_token ?? row?.qrToken ?? null;
  return createSlotQrPayload(id, token);
}

/**
 * Booking gate: scanned payload must match this slot. If the slot has a qr_token in DB,
 * the scan must include the same token (legacy easypark:slot:id only matches slots with no token).
 */
export function isSlotQrValidForBooking(slot, parsed) {
  if (!parsed?.slotId || !slot?.id) return false;
  if (parsed.slotId !== slot.id) return false;
  if (slot.qrToken) return !!parsed.qrToken && parsed.qrToken === slot.qrToken;
  return true;
}

