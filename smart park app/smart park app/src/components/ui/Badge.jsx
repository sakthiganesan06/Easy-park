export default function Badge({ status, className = '' }) {
  const styles = {
    available: 'badge-available',
    locked: 'badge-locked',
    occupied: 'badge-occupied',
  };

  const labels = {
    available: 'Available',
    locked: 'Locked',
    occupied: 'Occupied',
  };

  return (
    <span className={`${styles[status] || styles.available} ${className}`}>
      {labels[status] || status}
    </span>
  );
}
