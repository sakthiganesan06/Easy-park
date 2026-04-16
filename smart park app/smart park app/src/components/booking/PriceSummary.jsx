import { formatCurrency, formatDuration } from '../../utils/formatters';
import Card from '../ui/Card';

export default function PriceSummary({ breakdown, totalPrice, totalMinutes }) {
  if (!breakdown || breakdown.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-white/40 text-sm">Select a duration to see pricing</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
        Price Breakdown
      </h3>

      <div className="space-y-2">
        {breakdown.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-white/70">{item.label}</span>
            <span className="text-white font-medium">{formatCurrency(item.price)}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 pt-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/40">Total Duration</p>
          <p className="text-white font-semibold">{formatDuration(totalMinutes)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/40">Total Price</p>
          <p className="text-2xl font-bold text-electric-400">
            {formatCurrency(totalPrice)}
          </p>
        </div>
      </div>
    </Card>
  );
}
