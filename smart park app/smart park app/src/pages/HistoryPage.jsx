import { useBooking } from '../contexts/BookingContext';
import Navbar from '../components/layout/Navbar';
import BottomNav from '../components/layout/BottomNav';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { formatCurrency, formatDuration } from '../utils/formatters';
import { MapPin, Clock, Calendar, CreditCard } from 'lucide-react';

export default function HistoryPage() {
  const { bookingHistory } = useBooking();

  const statusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-emerald-400';
      case 'expired': return 'text-rose-400';
      default: return 'text-white/50';
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 pb-24">
      <Navbar title="Booking History" showBack />

      <div className="px-4 py-4 max-w-lg mx-auto animate-fade-in">
        <h2 className="text-lg font-bold text-white mb-4">Recent Bookings</h2>

        {bookingHistory.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No bookings yet</p>
            <p className="text-white/20 text-xs mt-1">Your booking history will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookingHistory.map((booking) => (
              <Card key={booking.id}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{booking.slotName}</p>
                    <div className="flex items-center gap-1.5 text-xs text-white/40 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{booking.slotAddress}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold capitalize ${statusColor(booking.status)}`}>
                    {booking.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-white/50">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(booking.duration)}
                  </div>
                  <div className="flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    {formatCurrency(booking.totalPrice)}
                  </div>
                  <span className="text-white/20 text-[10px]">
                    {new Date(booking.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-white/20">Ref: {booking.ref}</span>
                  <span className="text-[10px] text-white/20 capitalize">{booking.paymentMethod || '-'}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
