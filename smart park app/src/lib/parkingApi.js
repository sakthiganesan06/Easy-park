import { supabase } from './supabase';
import { BOOKING_GEOFENCE_METERS, LOCK_DURATION_MS, PAYMENT_DURATION_MS } from '../utils/constants';
const SLOT_IMAGES_BUCKET = 'slot-images';

// ─── Password hashing (SHA-256 via Web Crypto — no library needed) ─────────────
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(String(password));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function appendRlsHint(message) {
  const m = String(message || '');
  if (!/row-level security/i.test(m)) return m;
  return `${m}. In Supabase SQL Editor, run docs/supabase_fix_parking_slots_rls.sql (anon key + no JWT: policies must not use auth.uid()).`;
}

function mustOk(result, fallbackMsg) {
  if (result?.error) {
    const msg = appendRlsHint(result.error.message || fallbackMsg || 'Supabase error');
    throw new Error(msg);
  }
  return result.data;
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  return supabase;
}

/** Latest active booking per slot (any ongoing status). */
async function getActiveBookingsBySlotIds(sb, slotIds) {
  if (!slotIds.length) return {};
  const res = await sb
    .from('bookings')
    .select('slot_id, status, created_at')
    .in('slot_id', slotIds)
    .in('status', ['locked', 'arrived', 'paid', 'active'])
    .order('created_at', { ascending: false });
  if (res.error) {
    console.warn('EasyPark: failed to query bookings for slot status:', res.error.message);
    return {};
  }
  const bySlot = {};
  for (const b of res.data || []) {
    if (bySlot[b.slot_id]) continue; // keep latest
    const t = new Date(b.created_at).getTime();
    if (Number.isNaN(t)) continue;
    bySlot[b.slot_id] = { status: b.status, createdAtMs: t, id: b.slot_id };
  }
  return bySlot;
}

/** Determine effective slot status from booking lifecycle. */
function resolveEffectiveStatus(booking) {
  if (!booking) return 'available';
  switch (booking.status) {
    case 'locked': {
      const lockExpiry = booking.createdAtMs + LOCK_DURATION_MS;
      return Date.now() > lockExpiry ? '__expired_lock__' : 'locked';
    }
    case 'arrived': {
      // Payment phase — check if 5-min payment window is gone
      // Approximate: lock started at createdAtMs, arrival is at most 10 min later,
      // so total max time is createdAtMs + LOCK + PAYMENT
      const paymentDeadline = booking.createdAtMs + LOCK_DURATION_MS + PAYMENT_DURATION_MS;
      return Date.now() > paymentDeadline ? '__expired_payment__' : 'booking';
    }
    case 'paid':
    case 'active':
      return 'booked';
    default:
      return 'available';
  }
}

export async function createUser(name, phone) {
  const sb = requireSupabase();
  const normalizedPhone = String(phone || '').trim();
  const normalizedName = String(name || '').trim();
  if (!normalizedPhone) throw new Error('Phone is required');
  if (!normalizedName) throw new Error('Name is required');

  const res = await sb
    .from('users')
    .upsert({ name: normalizedName, phone: normalizedPhone }, { onConflict: 'phone' })
    .select('*')
    .single();

  return mustOk(res, 'Failed to create user');
}

/**
 * SIGN UP — saves a new user to Supabase with a hashed password.
 * Returns the created user row.
 * Throws if the phone already exists.
 */
export async function signupUser(name, phone, password) {
  const sb = requireSupabase();
  const normalizedPhone = String(phone || '').trim();
  const normalizedName = String(name || '').trim();
  if (!normalizedPhone) throw new Error('Phone is required');
  if (!normalizedName) throw new Error('Name is required');
  if (!password) throw new Error('Password is required');

  // Check phone not already registered
  const checkRes = await sb
    .from('users')
    .select('id')
    .eq('phone', normalizedPhone)
    .maybeSingle();
  if (checkRes.data) {
    throw new Error('An account with this number already exists. Please login.');
  }

  const password_hash = await hashPassword(password);

  const res = await sb
    .from('users')
    .insert({
      name: normalizedName,
      phone: normalizedPhone,
      password_hash,
      wallet_balance: 500,
    })
    .select('*')
    .single();

  return mustOk(res, 'Failed to create account');
}

/**
 * LOGIN — looks up user by phone and verifies hashed password.
 * Returns the user row on success.
 * Throws descriptive errors on failure.
 */
export async function loginUser(phone, password) {
  const sb = requireSupabase();
  const normalizedPhone = String(phone || '').trim();
  if (!normalizedPhone) throw new Error('Phone is required');
  if (!password) throw new Error('Password is required');

  const res = await sb
    .from('users')
    .select('*')
    .eq('phone', normalizedPhone)
    .maybeSingle();

  if (res.error) throw new Error(res.error.message || 'Login failed');
  if (!res.data) throw new Error('No account found with this number. Please sign up first.');

  const incoming_hash = await hashPassword(password);
  if (res.data.password_hash !== incoming_hash) {
    throw new Error('Incorrect password. Please try again.');
  }

  return res.data;
}

export async function getNearbySlots(lat, lng) {
  const sb = requireSupabase();
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new Error('lat/lng required');
  }

  const delta = 0.02;
  const res = await sb
    .from('parking_slots')
    .select('*')
    .gte('latitude', lat - delta)
    .lte('latitude', lat + delta)
    .gte('longitude', lng - delta)
    .lte('longitude', lng + delta)
    .order('created_at', { ascending: false });

  const rows = mustOk(res, 'Failed to fetch nearby slots') || [];
  const unavailableIds = rows.filter((s) => !s.is_available).map((s) => s.id);
  const activeBookings = await getActiveBookingsBySlotIds(sb, unavailableIds);

  const results = [];
  for (const s of rows) {
    const booking = activeBookings[s.id];
    let effective_status = 'available';
    let lock_expires_at = null;

    if (!s.is_available) {
      if (!booking) {
        // No booking found but slot is unavailable — treat as locked (safer than 'available')
        effective_status = 'locked';
      } else {
        const resolved = resolveEffectiveStatus(booking);
        if (resolved === '__expired_lock__' || resolved === '__expired_payment__') {
          effective_status = 'available';
        } else {
          effective_status = resolved;
          if (booking.status === 'locked') {
            lock_expires_at = new Date(booking.createdAtMs + LOCK_DURATION_MS).toISOString();
          }
        }
      }
    }

    results.push({
      ...s,
      effective_status,
      lock_expires_at,
      distance_m: calculateDistance(lat, lng, s.latitude, s.longitude),
    });
  }

  return results.sort((a, b) => a.distance_m - b.distance_m);
}

export async function getSlotById(slotId) {
  const sb = requireSupabase();
  if (!slotId) throw new Error('slotId required');
  const res = await sb
    .from('parking_slots')
    .select('*')
    .eq('id', slotId)
    .single();
  const slot = mustOk(res, 'Failed to fetch slot');

  if (!slot.is_available) {
    const bookings = await getActiveBookingsBySlotIds(sb, [slotId]);
    const booking = bookings[slotId];

    if (!booking) {
      // No booking found — treat as locked (safer default)
      slot.effective_status = 'locked';
    } else {
      const resolved = resolveEffectiveStatus(booking);

      if (resolved === '__expired_lock__' || resolved === '__expired_payment__') {
        // Auto-release expired booking
        try {
          const bRes = await sb.from('bookings').select('id')
            .eq('slot_id', slotId).in('status', ['locked', 'arrived'])
            .order('created_at', { ascending: false }).limit(1);
          if (bRes.data?.[0]?.id) {
            await sb.from('bookings').update({ status: 'cancelled' }).eq('id', bRes.data[0].id);
          }
          await releaseSlot(slotId);
          slot.is_available = true;
          slot.effective_status = 'available';
        } catch (e) {
          console.error('EasyPark: auto-release failed', e);
          slot.effective_status = 'available';
        }
      } else {
        slot.effective_status = resolved;
        if (booking.status === 'locked') {
          slot.lock_expires_at = new Date(booking.createdAtMs + LOCK_DURATION_MS).toISOString();
        }
      }
    }
  } else {
    slot.effective_status = 'available';
  }

  return slot;
}

export async function getSlotsByOwner(ownerId) {
  const sb = requireSupabase();
  if (!ownerId) throw new Error('ownerId required');
  const res = await sb
    .from('parking_slots')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  return mustOk(res, 'Failed to fetch owner slots') || [];
}

export async function createParkingSlot({
  ownerId,
  name,
  address,
  ownerPhone,
  latitude,
  longitude,
  pricing,
  vehicleTypes,
  imageUrl = null,
  qrToken = null,
}) {
  const sb = requireSupabase();
  if (!ownerId) throw new Error('ownerId required');
  if (typeof latitude !== 'number' || typeof longitude !== 'number') throw new Error('lat/lng required');

  const res = await sb
    .from('parking_slots')
    .insert({
      owner_id: ownerId,
      name: String(name || 'Parking Slot').trim() || 'Parking Slot',
      address: String(address || '').trim(),
      owner_phone: ownerPhone ? String(ownerPhone).trim() : null,
      latitude,
      longitude,
      pricing: pricing || {},
      vehicle_types: Array.isArray(vehicleTypes) ? vehicleTypes : [],
      image_url: imageUrl,
      qr_token: qrToken,
      is_available: true,
    })
    .select('*')
    .single();

  return mustOk(res, 'Failed to create parking slot');
}

export async function uploadParkingSlotImage(ownerId, file) {
  const sb = requireSupabase();
  if (!ownerId) throw new Error('ownerId required');
  if (!file) return null;

  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase();
  const fileName = `${ownerId}/${crypto.randomUUID()}.${ext}`;

  const uploadRes = await sb.storage
    .from(SLOT_IMAGES_BUCKET)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });

  if (uploadRes.error) {
    const msg = String(uploadRes.error.message || '');
    // Common when `slot-images` bucket was never created in Supabase Dashboard / SQL
    if (/bucket not found|not found/i.test(msg) || uploadRes.error.statusCode === '404') {
      return null;
    }
    throw new Error(appendRlsHint(msg || 'Failed to upload slot image'));
  }

  const { data } = sb.storage.from(SLOT_IMAGES_BUCKET).getPublicUrl(fileName);
  return data?.publicUrl || null;
}

export async function seedDemoSlots(ownerId, baseLat, baseLng) {
  const sb = requireSupabase();
  if (!ownerId) throw new Error('ownerId required');
  if (typeof baseLat !== 'number' || typeof baseLng !== 'number') throw new Error('lat/lng required');

  const offsets = [
    { dlat: 0.003, dlng: 0.002 },
    { dlat: -0.002, dlng: 0.004 },
    { dlat: 0.005, dlng: -0.001 },
    { dlat: -0.004, dlng: -0.003 },
    { dlat: 0.001, dlng: 0.006 },
    { dlat: -0.006, dlng: 0.001 },
    { dlat: 0.004, dlng: 0.004 },
    { dlat: -0.001, dlng: -0.005 },
    { dlat: 0.006, dlng: -0.003 },
    { dlat: -0.003, dlng: 0.005 },
  ];

  const names = [
    'Sunshine Parking Hub',
    'GreenPark Basement',
    'Metro Mall Parking',
    'RK Towers Lot',
    'Lakeview Open Park',
    'Star Complex Parking',
    'Blue Bay Garage',
    'Central Avenue Slot',
    'Heritage Point Parking',
    'Riverside Open Lot',
  ];

  const addresses = [
    '12, MG Road, Near City Mall',
    '45, Anna Nagar, 2nd Street',
    '78, T Nagar, Metro Station Rd',
    '23, Adyar, RK Towers, Ground Floor',
    '56, Besant Nagar, Lake Area',
    '89, Mylapore, Star Complex',
    '34, Nungambakkam, Blue Bay',
    '67, Egmore, Central Avenue',
    '91, Triplicane, Heritage Lane',
    '15, Guindy, Riverside Road',
  ];

  const payload = offsets.map((o, i) => ({
    owner_id: ownerId,
    name: names[i],
    address: addresses[i],
    latitude: baseLat + o.dlat,
    longitude: baseLng + o.dlng,
    qr_token: crypto.randomUUID(),
    pricing: {
      min20: 10 + i * 2,
      min30: 15 + i * 3,
      min40: 20 + i * 3,
      hr1: 30 + i * 5,
      hr2: 55 + i * 8,
      hr3: 75 + i * 10,
    },
    vehicle_types: i % 3 === 0
      ? ['car', 'bike', 'auto']
      : i % 3 === 1
        ? ['car', 'bike']
        : ['bike', 'auto'],
    is_available: true,
  }));

  const res = await sb.from('parking_slots').insert(payload).select('id');
  return mustOk(res, 'Failed to seed demo slots');
}

export async function createBooking(userId, slotId, duration, userLat, userLng) {
  const sb = requireSupabase();
  if (!userId) throw new Error('userId required');
  if (!slotId) throw new Error('slotId required');
  if (!duration || duration <= 0) throw new Error('duration required');
  if (typeof userLat !== 'number' || typeof userLng !== 'number') {
    throw new Error('user location required for geo-check');
  }

  const slotRes = await sb
    .from('parking_slots')
    .select('*')
    .eq('id', slotId)
    .single();
  const slot = mustOk(slotRes, 'Slot not found');

  if (!slot.is_available) throw new Error('Slot not available');

  const dist = calculateDistance(userLat, userLng, slot.latitude, slot.longitude);
  if (dist >= BOOKING_GEOFENCE_METERS) {
    throw new Error(`You must be within ${BOOKING_GEOFENCE_METERS} meters to book this slot`);
  }

  const bookingRes = await sb
    .from('bookings')
    .insert({
      user_id: userId,
      slot_id: slotId,
      duration,
      status: 'locked',
      payment_status: 'unpaid',
    })
    .select('*')
    .single();

  return { booking: mustOk(bookingRes, 'Failed to create booking'), slot, distance_m: dist };
}

export async function lockSlot(slotId) {
  const sb = requireSupabase();
  if (!slotId) throw new Error('slotId required');
  const res = await sb
    .from('parking_slots')
    .update({ is_available: false })
    .eq('id', slotId)
    .select('*')
    .single();
  return mustOk(res, 'Failed to lock slot');
}

export async function startSession(bookingId) {
  const sb = requireSupabase();
  if (!bookingId) throw new Error('bookingId required');

  const bookingRes = await sb
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();
  const booking = mustOk(bookingRes, 'Booking not found');

  const now = new Date();
  const end = new Date(now.getTime() + (booking.duration || 0) * 60 * 1000);

  const res = await sb
    .from('bookings')
    .update({
      status: 'active',
      start_time: now.toISOString(),
      end_time: end.toISOString(),
    })
    .eq('id', bookingId)
    .select('*')
    .single();

  return mustOk(res, 'Failed to start session');
}

export async function endSession(bookingId) {
  const sb = requireSupabase();
  if (!bookingId) throw new Error('bookingId required');

  const bookingRes = await sb
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();
  const booking = mustOk(bookingRes, 'Booking not found');

  // Preserve the scheduled end_time (start_time + duration) — do NOT overwrite it.
  // Store the actual wall-clock end in completed_at so both values are available.
  const endRes = await sb
    .from('bookings')
    .update({
      status:       'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select('*')
    .single();
  const updated = mustOk(endRes, 'Failed to end session');

  await releaseSlot(booking.slot_id);
  return updated;
}


export async function updateBookingStatus(bookingId, newStatus) {
  const sb = requireSupabase();
  if (!bookingId) throw new Error('bookingId required');
  const res = await sb
    .from('bookings')
    .update({ status: newStatus })
    .eq('id', bookingId)
    .select('*')
    .single();
  return mustOk(res, 'Failed to update booking status');
}

/**
 * Save complete payment details to Supabase when a booking is paid.
 * Stores: status, payment_method, base_amount, penalty_amount,
 *         extension_minutes, extension_amount, total_amount, paid_at.
 */
export async function savePaymentDetails(bookingId, {
  paymentMethod,
  baseAmount,
  penaltyAmount = 0,
  extensionMinutes = 0,
  extensionAmount = 0,
  totalAmount,
}) {
  const sb = requireSupabase();
  if (!bookingId) throw new Error('bookingId required');

  const update = {
    status: 'paid',
    payment_status: 'paid',
    payment_method: paymentMethod || 'unknown',
    base_amount: baseAmount ?? 0,
    penalty_amount: penaltyAmount ?? 0,
    extension_minutes: extensionMinutes ?? 0,
    extension_amount: extensionAmount ?? 0,
    total_amount: totalAmount ?? ((baseAmount ?? 0) + (penaltyAmount ?? 0) + (extensionAmount ?? 0)),
    paid_at: new Date().toISOString(),
  };

  const res = await sb
    .from('bookings')
    .update(update)
    .eq('id', bookingId)
    .select('*')
    .single();

  return mustOk(res, 'Failed to save payment details');
}


export async function releaseSlot(slotId) {
  const sb = requireSupabase();
  if (!slotId) throw new Error('slotId required');
  const res = await sb
    .from('parking_slots')
    .update({ is_available: true })
    .eq('id', slotId)
    .select('*')
    .single();
  return mustOk(res, 'Failed to release slot');
}

export async function cancelBooking(bookingId) {
  const sb = requireSupabase();
  if (!bookingId) throw new Error('bookingId required');
  const bookingRes = await sb
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();
  const booking = mustOk(bookingRes, 'Booking not found');

  const res = await sb
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .select('*')
    .single();
  const updated = mustOk(res, 'Failed to cancel booking');

  await releaseSlot(booking.slot_id);
  return updated;
}

/**
 * Save a review (rating + optional comment) for a completed booking.
 */
export async function saveReview({ slotId, userId, bookingId, rating, comment, userName }) {
  const sb = requireSupabase();
  if (!slotId) throw new Error('slotId required');
  if (!userId) throw new Error('userId required');
  if (!rating || rating < 1 || rating > 5) throw new Error('rating must be 1-5');

  const res = await sb
    .from('reviews')
    .insert({
      slot_id: slotId,
      user_id: userId,
      booking_id: bookingId || null,
      rating,
      comment: String(comment || '').trim(),
      user_name: userName || 'Anonymous',
    })
    .select('*')
    .single();

  return mustOk(res, 'Failed to save review');
}

/**
 * Fetch all reviews for a slot, sorted newest first.
 * Returns { reviews: [...], averageRating: number, totalReviews: number }
 */
export async function getSlotReviews(slotId) {
  const sb = requireSupabase();
  if (!slotId) throw new Error('slotId required');

  const res = await sb
    .from('reviews')
    .select('*')
    .eq('slot_id', slotId)
    .order('created_at', { ascending: false });

  const rows = mustOk(res, 'Failed to fetch reviews') || [];

  const totalReviews = rows.length;
  const averageRating =
    totalReviews > 0
      ? parseFloat((rows.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
      : 0;

  return { reviews: rows, averageRating, totalReviews };
}

/**
 * Extend an active booking session by `extraMinutes`.
 * Updates end_time and duration in the bookings table.
 */
export async function extendBookingSession(bookingId, extraMinutes) {
  const sb = requireSupabase();
  if (!bookingId) throw new Error('bookingId required');
  if (!extraMinutes || extraMinutes <= 0) throw new Error('extraMinutes required');

  const bookingRes = await sb
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();
  const booking = mustOk(bookingRes, 'Booking not found');

  const oldEnd = booking.end_time ? new Date(booking.end_time) : new Date();
  const newEnd = new Date(Math.max(oldEnd.getTime(), Date.now()) + extraMinutes * 60 * 1000);
  const newDuration = (booking.duration || 0) + extraMinutes;

  const res = await sb
    .from('bookings')
    .update({
      end_time: newEnd.toISOString(),
      duration: newDuration,
      status: 'active',
    })
    .eq('id', bookingId)
    .select('*')
    .single();

  return mustOk(res, 'Failed to extend session');
}

/**
 * Record a warning for a booking (misuse tracking).
 * Increments warning_count on the booking row.
 * Also increments total_warnings on the user row.
 */
export async function recordBookingWarning(bookingId, userId) {
  const sb = requireSupabase();
  if (!bookingId) throw new Error('bookingId required');

  // Increment booking warning_count
  const bRes = await sb.rpc('increment_booking_warnings', { b_id: bookingId });
  // If RPC doesn't exist, fall back to manual update
  if (bRes.error) {
    const cur = await sb.from('bookings').select('warning_count').eq('id', bookingId).single();
    const count = (cur.data?.warning_count || 0) + 1;
    await sb.from('bookings').update({ warning_count: count }).eq('id', bookingId);
  }

  // Increment user total_warnings
  if (userId) {
    const uRes = await sb.rpc('increment_user_warnings', { u_id: userId });
    if (uRes.error) {
      const cur = await sb.from('users').select('total_warnings').eq('id', userId).single();
      const count = (cur.data?.total_warnings || 0) + 1;
      await sb.from('users').update({ total_warnings: count }).eq('id', userId);
    }
  }
}

/**
 * Get penalty info for a user: total warnings, bookings with warnings, active penalty flag.
 */
export async function getUserPenaltyInfo(userId) {
  const sb = requireSupabase();
  if (!userId) return { totalWarnings: 0, warningBookings: 0, hasPenalty: false };

  try {
    const userRes = await sb
      .from('users')
      .select('total_warnings, penalty_flag')
      .eq('id', userId)
      .single();
    const user = userRes.data || {};

    // Count distinct bookings that have warnings
    const bRes = await sb
      .from('bookings')
      .select('id')
      .eq('user_id', userId)
      .gt('warning_count', 0);
    const warningBookings = bRes.data?.length || 0;

    return {
      totalWarnings: user.total_warnings || 0,
      warningBookings,
      hasPenalty: !!(user.penalty_flag),
    };
  } catch {
    return { totalWarnings: 0, warningBookings: 0, hasPenalty: false };
  }
}

/**
 * Mark a booking as misuse (5+ warnings in single booking).
 * Also sets penalty_flag on user for next booking.
 */
export async function markBookingMisuse(bookingId, userId) {
  const sb = requireSupabase();
  if (bookingId) {
    await sb.from('bookings').update({ misuse: true }).eq('id', bookingId);
  }
  if (userId) {
    await sb.from('users').update({ penalty_flag: true }).eq('id', userId);
  }
}

/**
 * Clear the penalty_flag on a user (after they've paid the penalty).
 */
export async function clearUserPenalty(userId) {
  const sb = requireSupabase();
  if (!userId) return;
  await sb.from('users').update({ penalty_flag: false }).eq('id', userId);
}

/**
 * Fetch all penalty records for a user.
 * Returns an array of { bookingRef, amount, status ('paid'|'pending'), date }
 * and a summary totalPaid / totalPending.
 */
export async function getUserPenalties(userId) {
  if (!userId) return { records: [], totalPaid: 0, totalPending: 0 };
  const sb = requireSupabase();
  try {
    const res = await sb
      .from('bookings')
      .select('id, status, penalty_amount, payment_status, start_time, created_at')
      .eq('user_id', userId)
      .gt('penalty_amount', 0)
      .order('created_at', { ascending: false });

    if (res.error || !res.data) return { records: [], totalPaid: 0, totalPending: 0 };

    let totalPaid = 0;
    let totalPending = 0;

    const records = res.data.map((b, i) => {
      const amount = b.penalty_amount || 0;
      // A penalty is 'paid' if the booking itself was paid/completed
      const isPaid = b.payment_status === 'paid' || b.status === 'completed';
      if (isPaid) totalPaid += amount;
      else totalPending += amount;

      return {
        id: b.id,
        bookingRef: `#${i + 1}`,           // simple sequential reference
        amount,
        status: isPaid ? 'paid' : 'pending',
        date: b.start_time || b.created_at,
      };
    });

    return { records, totalPaid, totalPending };
  } catch {
    return { records: [], totalPaid: 0, totalPending: 0 };
  }
}


export function subscribeToSlots(onChange) {
  const sb = requireSupabase();
  const channel = sb
    .channel('parking_slots_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'parking_slots' },
      (payload) => onChange?.(payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bookings' },
      (payload) => onChange?.(payload)
    )
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}

/**
 * Persist a notification to the user_notifications table in Supabase.
 * Silently fails if the table doesn't exist yet — caller should not throw.
 *
 * @param {{ userId: string, type: string, title: string, message: string }} notif
 */
export async function saveUserNotification({ userId, type, title, message }) {
  if (!userId) return;
  const sb = requireSupabase();
  try {
    await sb.from('user_notifications').insert({
      user_id:    userId,
      type:       type   || 'info',
      title:      title  || '',
      message:    message || '',
      read:       false,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    // Table may not exist — degrade gracefully
    console.warn('EasyPark: saveUserNotification skipped (table missing?):', e?.message || e);
  }
}

/**
 * Load all notifications for a user from Supabase, newest first.
 */
export async function getUserNotifications(userId) {
  if (!userId) return [];
  const sb = requireSupabase();
  try {
    const res = await sb
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (res.error) return [];
    return res.data || [];
  } catch {
    return [];
  }
}
