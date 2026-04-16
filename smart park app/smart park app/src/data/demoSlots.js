// Demo parking slots seeded around a base location
// These will be placed relative to the user's actual GPS position

export function generateDemoSlots(baseLat, baseLng) {
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

  const ownerNames = [
    'Rajesh Kumar', 'Priya Sharma', 'Vikram Singh', 'Anita Devi',
    'Suresh Babu', 'Meena Kumari', 'Karthik Rajan', 'Lakshmi Narayanan',
    'Deepak Chand', 'Sunita Patel',
  ];

  return offsets.map((offset, i) => ({
    id: `demo-slot-${i + 1}`,
    ownerId: `demo-owner-${i + 1}`,
    ownerName: ownerNames[i],
    ownerPhone: `98765${String(43210 + i).padStart(5, '0')}`,
    location: {
      lat: baseLat + offset.dlat,
      lng: baseLng + offset.dlng,
    },
    address: addresses[i],
    name: names[i],
    pricing: {
      min20: 10 + i * 2,
      min30: 15 + i * 3,
      min40: 20 + i * 3,
      hr1: 30 + i * 5,
      hr2: 55 + i * 8,
      hr3: 75 + i * 10,
    },
    vehicleTypes: i % 3 === 0
      ? ['car', 'bike', 'auto']
      : i % 3 === 1
        ? ['car', 'bike']
        : ['bike', 'auto'],
    imageUrl: null,
    status: 'available',
    rating: (3.5 + Math.random() * 1.5).toFixed(1),
    totalSpots: Math.floor(Math.random() * 10) + 3,
    createdAt: new Date().toISOString(),
  }));
}

export function getStoredSlots() {
  try {
    const stored = localStorage.getItem('easypark_slots');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveSlots(slots) {
  localStorage.setItem('easypark_slots', JSON.stringify(slots));
}

export function initializeDemoData(lat, lng) {
  let slots = getStoredSlots();
  if (!slots || slots.length === 0) {
    slots = generateDemoSlots(lat, lng);
    saveSlots(slots);
  }
  return slots;
}

export function addSlot(slot) {
  const slots = getStoredSlots() || [];
  slots.push(slot);
  saveSlots(slots);
  return slots;
}

export function updateSlotStatus(slotId, status) {
  const slots = getStoredSlots() || [];
  const idx = slots.findIndex((s) => s.id === slotId);
  if (idx !== -1) {
    slots[idx].status = status;
    saveSlots(slots);
  }
  return slots;
}
