export default function Badge({ status, className = '' }) {
  const styles = {
    available: 'badge-available',
    locked: 'badge-locked',
    booking: 'badge-booking',
    booked: 'badge-booked',
    occupied: 'badge-occupied',
  };

  const labels = {
    available: 'Available',
    locked: 'Locked',
    booking: 'Booking',
    booked: 'Booked',
    occupied: 'Occupied',
  };

  return (
    <span className={`${styles[status] || styles.available} ${className}`}>
      {labels[status] || status}
    </span>
  );
}
