import { DURATION_OPTIONS } from '../../utils/constants';

export default function DurationSelector({ selectedKeys, onToggle }) {
  const minuteOptions = DURATION_OPTIONS.filter((d) => d.minutes < 60);
  const hourOptions = DURATION_OPTIONS.filter((d) => d.minutes >= 60);

  return (
    <div className="space-y-4">
      {/* Minutes */}
      <div>
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Minutes</p>
        <div className="flex flex-wrap gap-2">
          {minuteOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onToggle(opt.key)}
              className={`duration-chip ${
                selectedKeys.includes(opt.key) ? 'selected' : 'unselected'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hours */}
      <div>
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Hours</p>
        <div className="flex flex-wrap gap-2">
          {hourOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onToggle(opt.key)}
              className={`duration-chip ${
                selectedKeys.includes(opt.key) ? 'selected' : 'unselected'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
