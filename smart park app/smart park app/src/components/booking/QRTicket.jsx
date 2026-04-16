import QRCode from 'react-qr-code';
import Card from '../ui/Card';
import { formatCurrency, formatDuration } from '../../utils/formatters';
import { MapPin, Clock, CreditCard, Car } from 'lucide-react';

export default function QRTicket({ booking }) {
  if (!booking) return null;

  const qrData = JSON.stringify({
    ref: booking.ref,
    slot: booking.slotName,
    duration: booking.duration,
    amount: booking.totalPrice,
    vehicle: booking.vehicleType,
    time: booking.paidAt,
  });

  return (
    <div className="relative">
      {/* Ticket card */}
      <Card className="space-y-4 !rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="text-center pb-3 border-b border-white/10">
          <p className="text-xs text-white/40 uppercase tracking-widest">Parking Ticket</p>
          <p className="text-lg font-bold text-electric-400 mt-1">{booking.ref}</p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center py-3">
          <div className="bg-white p-4 rounded-2xl">
            <QRCode value={qrData} size={160} level="M" />
          </div>
        </div>

        {/* Tear line */}
        <div className="relative">
          <div className="border-t-2 border-dashed border-white/10" />
          <div className="absolute -left-8 -top-3 w-6 h-6 bg-navy-900 rounded-full" />
          <div className="absolute -right-8 -top-3 w-6 h-6 bg-navy-900 rounded-full" />
        </div>

        {/* Details */}
        <div className="space-y-3 pt-1">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-electric-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-white/40">Location</p>
              <p className="text-sm text-white font-medium">{booking.slotName}</p>
              <p className="text-xs text-white/50">{booking.slotAddress}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <div>
                <p className="text-xs text-white/40">Duration</p>
                <p className="text-sm text-white font-medium">{formatDuration(booking.duration)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="text-xs text-white/40">Paid</p>
                <p className="text-sm text-emerald-400 font-bold">{formatCurrency(booking.totalPrice)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-white/40" />
            <div>
              <p className="text-xs text-white/40">Vehicle</p>
              <p className="text-sm text-white font-medium capitalize">{booking.vehicleType}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
