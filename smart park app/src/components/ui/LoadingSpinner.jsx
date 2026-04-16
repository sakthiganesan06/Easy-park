import { Car } from 'lucide-react';

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-navy-900 gap-4">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-white/10 rounded-full" />
        <div className="absolute inset-0 w-16 h-16 border-4 border-electric-500 rounded-full border-t-transparent animate-spin" />
        <Car className="absolute inset-0 m-auto w-6 h-6 text-electric-400" />
      </div>
      <p className="text-white/50 text-sm animate-pulse">{message}</p>
    </div>
  );
}
