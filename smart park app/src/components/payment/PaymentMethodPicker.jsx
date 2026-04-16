import { useState } from 'react';
import { Smartphone, Wallet, Check } from 'lucide-react';
import Card from '../ui/Card';

export default function PaymentMethodPicker({ selected, onSelect }) {
  const methods = [
    {
      id: 'upi',
      label: 'UPI',
      description: 'Pay via any UPI app',
      icon: Smartphone,
      color: 'text-electric-400',
      bg: 'bg-electric-500/10',
      border: 'border-electric-500',
    },
    {
      id: 'wallet',
      label: 'Wallet',
      description: 'Pay from Easy Park wallet',
      icon: Wallet,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500',
    },
  ];

  return (
    <div className="space-y-3">
      {methods.map((method) => {
        const isSelected = selected === method.id;
        const Icon = method.icon;
        return (
          <button
            key={method.id}
            onClick={() => onSelect(method.id)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
              isSelected
                ? `${method.bg} ${method.border} border-2`
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg ${method.bg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${method.color}`} />
            </div>
            <div className="text-left flex-1">
              <p className="text-white font-semibold text-sm">{method.label}</p>
              <p className="text-white/40 text-xs">{method.description}</p>
            </div>
            {isSelected && (
              <div className={`w-6 h-6 rounded-full ${method.bg} flex items-center justify-center`}>
                <Check className={`w-4 h-4 ${method.color}`} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
