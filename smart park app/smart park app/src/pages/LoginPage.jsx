import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Phone, User, Shield, ArrowRight, Info } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import OTPInput from '../components/otp/OTPInput';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { sendOTP, verifyOTP, otpSent, generatedOtp } = useAuth();

  const [step, setStep] = useState(1); // 1: name+phone, 2: otp
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [displayOtp, setDisplayOtp] = useState('');

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Please enter your name');
    if (!/^\d{10}$/.test(phone)) return toast.error('Enter a valid 10-digit mobile number');

    setLoading(true);
    try {
      const result = await sendOTP(name.trim(), phone);
      if (result.success) {
        setDisplayOtp(result.otp);
        setStep(2);
        toast.success('OTP sent successfully!');
      }
    } catch (err) {
      toast.error('Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (code) => {
    setLoading(true);
    try {
      const result = await verifyOTP(code);
      if (result.success) {
        toast.success('Login successful! Welcome to EasyPark');
        navigate('/', { replace: true });
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error('Verification failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-navy-900 relative overflow-hidden flex flex-col">
      {/* Background gradient orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-electric-500/10 rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      {/* Header */}
      <div className="relative pt-16 pb-8 px-6 text-center">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-electric-500 to-electric-700 shadow-glow-blue mb-6 animate-bounce-subtle">
          <MapPin className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Easy<span className="text-electric-400">Park</span>
        </h1>
        <p className="text-white/50 text-sm max-w-xs mx-auto">
          Find, book, and pay for parking spaces near you — in seconds
        </p>
      </div>

      {/* Form Card */}
      <div className="relative flex-1 px-6 pb-8">
        <div className="glass-card p-6 max-w-sm mx-auto animate-slide-up">
          {step === 1 ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-1">Welcome</h2>
                <p className="text-white/40 text-sm">Enter your details to get started</p>
              </div>
              <form onSubmit={handleSendOTP} className="space-y-4">
                <Input
                  label="Full Name"
                  icon={User}
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  label="Mobile Number"
                  icon={Phone}
                  type="tel"
                  placeholder="Enter 10-digit number"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setPhone(val);
                  }}
                  maxLength={10}
                  required
                />
                <Button
                  type="submit"
                  fullWidth
                  loading={loading}
                  icon={ArrowRight}
                  className="mt-2"
                >
                  Send OTP
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-1">Verify OTP</h2>
                <p className="text-white/40 text-sm">
                  Enter the 6-digit code sent to{' '}
                  <span className="text-white/70">+91 {phone}</span>
                </p>
              </div>

              {/* Demo OTP display */}
              <div className="bg-electric-500/10 border border-electric-500/30 rounded-xl p-3 mb-4 flex items-start gap-2">
                <Info className="w-4 h-4 text-electric-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-electric-400 font-medium">Demo Mode</p>
                  <p className="text-sm text-white/70">
                    Your OTP is: <span className="font-bold text-electric-400 tracking-widest">{displayOtp}</span>
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <OTPInput length={6} onComplete={handleVerifyOTP} disabled={loading} />
              </div>

              {loading && (
                <div className="flex justify-center">
                  <div className="w-6 h-6 border-2 border-electric-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              <button
                onClick={() => setStep(1)}
                className="w-full text-center text-sm text-white/40 hover:text-white/60 mt-4 transition-colors"
              >
                ← Change phone number
              </button>
            </>
          )}
        </div>

        {/* Features preview */}
        <div className="mt-8 flex items-center justify-center gap-6 text-center max-w-sm mx-auto">
          {[
            { icon: Shield, label: 'Secure' },
            { icon: MapPin, label: 'GPS-Based' },
            { icon: Phone, label: 'Quick Login' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Icon className="w-5 h-5 text-white/30" />
              </div>
              <span className="text-[10px] text-white/30 font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
