export default function Input({
  label,
  icon: Icon,
  error,
  className = '',
  ...props
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-white/60 ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
        )}
        <input
          className={`input-field ${Icon ? 'pl-12' : ''} ${
            error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''
          } ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="text-rose-400 text-xs ml-1 animate-slide-down">{error}</p>
      )}
    </div>
  );
}
