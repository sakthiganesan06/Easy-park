import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  MapPin, Phone, User, Lock, Shield, ArrowRight,
  Info, Eye, EyeOff, ChevronLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── tiny reusable input ─────────────────────────────────────────────── */
function Field({ label, icon: Icon, type = 'text', value, onChange, placeholder, maxLength, extra }) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPw ? 'text' : 'password') : type;

  return (
    <div className="auth-field">
      <label className="auth-field__label">{label}</label>
      <div className="auth-field__wrap">
        <Icon className="auth-field__icon" />
        <input
          className="auth-field__input"
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          required
        />
        {isPassword && (
          <button
            type="button"
            className="auth-field__eye"
            onClick={() => setShowPw((v) => !v)}
            tabIndex={-1}
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {extra}
    </div>
  );
}

/* ─── OTP boxes ───────────────────────────────────────────────────────── */
function OtpBoxes({ onComplete, disabled }) {
  const [digits, setDigits] = useState(Array(6).fill(''));

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
    if (next.every(Boolean)) onComplete(next.join(''));
  };

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      document.getElementById(`otp-${i - 1}`)?.focus();
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      const arr = text.split('');
      setDigits(arr);
      onComplete(text);
    }
  };

  return (
    <div className="otp-boxes" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          id={`otp-${i}`}
          className="otp-box"
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

/* ─── main page ───────────────────────────────────────────────────────── */
export default function LoginPage() {
  const navigate = useNavigate();
  const { signup, login, verifyOTP } = useAuth();

  /* tab: 'login' | 'signup' */
  const [tab, setTab] = useState('login');
  /* step: 'form' | 'otp' */
  const [step, setStep] = useState('form');

  /* shared fields */
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  /* signup-only */
  const [name, setName] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const [loading, setLoading] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');

  /* ── switch tab ── */
  const switchTab = (t) => {
    setTab(t);
    setStep('form');
    setPhone('');
    setPassword('');
    setName('');
    setConfirmPw('');
    setDemoOtp('');
  };

  /* ── submit form ── */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!/^\d{10}$/.test(phone))
      return toast.error('Enter a valid 10-digit mobile number');
    if (password.length < 6)
      return toast.error('Password must be at least 6 characters');

    if (tab === 'signup') {
      if (!name.trim()) return toast.error('Please enter your full name');
      if (password !== confirmPw) return toast.error('Passwords do not match');
    }

    setLoading(true);
    try {
      const result =
        tab === 'signup'
          ? await signup(name.trim(), phone, password)
          : await login(phone, password);

      if (!result.success) {
        toast.error(result.error);
      } else {
        setDemoOtp(result.otp);
        setStep('otp');
        toast.success('OTP sent! (Demo: see below)');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  /* ── verify OTP ── */
  const handleVerify = async (code) => {
    setLoading(true);
    try {
      const result = await verifyOTP(code);
      if (result.success) {
        toast.success(`Welcome${tab === 'signup' ? ' to EasyPark! 🎉' : ' back! 👋'}`);
        navigate('/', { replace: true });
      } else {
        toast.error(result.error || 'Invalid OTP');
      }
    } catch {
      toast.error('Verification failed');
    }
    setLoading(false);
  };

  return (
    <>
      {/* ── inline styles ── */}
      <style>{`
        .auth-root {
          min-height: 100dvh;
          background: radial-gradient(ellipse 100% 80% at 50% -10%, #0ea5e930 0%, transparent 70%),
                      linear-gradient(160deg, #0b1120 0%, #0f172a 60%, #0a1628 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 16px 40px;
          position: relative;
          overflow: hidden;
        }

        /* decorative blobs */
        .auth-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }
        .auth-blob--a {
          width: 500px; height: 500px;
          background: #3b82f650;
          top: -180px; left: 50%;
          transform: translateX(-50%);
        }
        .auth-blob--b {
          width: 300px; height: 300px;
          background: #10b98130;
          bottom: -100px; right: -80px;
        }
        .auth-blob--c {
          width: 200px; height: 200px;
          background: #8b5cf630;
          bottom: 0; left: -60px;
        }

        /* logo */
        .auth-logo {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 8px;
        }
        .auth-logo__icon {
          width: 52px; height: 52px; border-radius: 14px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 24px #3b82f650;
          animation: logoFloat 3s ease-in-out infinite;
        }
        .auth-logo__text { font-size: 26px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
        .auth-logo__text span { color: #60a5fa; }

        @keyframes logoFloat {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-5px); }
        }

        .auth-tagline {
          color: #64748b; font-size: 13px; margin-bottom: 28px; text-align: center;
        }

        /* card */
        .auth-card {
          width: 100%; max-width: 400px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 28px 24px;
          box-shadow: 0 24px 64px #00000060;
          backdrop-filter: blur(16px);
          position: relative;
          animation: cardIn 0.4s cubic-bezier(.22,1,.36,1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* tab switcher */
        .auth-tabs {
          display: flex;
          background: rgba(255,255,255,0.05);
          border-radius: 14px;
          padding: 4px;
          margin-bottom: 24px;
          gap: 4px;
        }
        .auth-tab {
          flex: 1; padding: 10px; border: none; cursor: pointer;
          border-radius: 10px; font-size: 14px; font-weight: 600;
          transition: all 0.25s ease;
          background: transparent; color: #64748b;
        }
        .auth-tab.active {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: #fff;
          box-shadow: 0 4px 16px #3b82f640;
        }

        /* heading inside card */
        .auth-heading { font-size: 20px; font-weight: 700; color: #f1f5f9; margin-bottom: 4px; }
        .auth-sub { font-size: 13px; color: #475569; margin-bottom: 20px; }

        /* form field */
        .auth-field { margin-bottom: 16px; }
        .auth-field__label { display: block; font-size: 12px; font-weight: 600;
          color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 6px; text-transform: uppercase; }
        .auth-field__wrap { position: relative; display: flex; align-items: center; }
        .auth-field__icon {
          position: absolute; left: 12px;
          width: 16px; height: 16px; color: #475569; pointer-events: none;
        }
        .auth-field__input {
          width: 100%; padding: 11px 12px 11px 38px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px; color: #f1f5f9; font-size: 14px;
          outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .auth-field__input::placeholder { color: #334155; }
        .auth-field__input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px #3b82f620;
        }
        .auth-field__eye {
          position: absolute; right: 12px; background: none; border: none;
          color: #475569; cursor: pointer; padding: 4px;
        }
        .auth-field__eye:hover { color: #94a3b8; }

        /* submit btn */
        .auth-btn {
          width: 100%; padding: 13px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border: none; border-radius: 13px; color: #fff;
          font-size: 15px; font-weight: 700; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.2s; margin-top: 8px;
          box-shadow: 0 4px 20px #3b82f640;
        }
        .auth-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 28px #3b82f660; }
        .auth-btn:active { transform: translateY(0); }
        .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        /* spinner */
        .auth-spinner {
          width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* divider */
        .auth-divider {
          display: flex; align-items: center; gap: 10px;
          color: #334155; font-size: 12px; margin: 8px 0 16px;
        }
        .auth-divider::before, .auth-divider::after {
          content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.07);
        }

        /* demo OTP banner */
        .demo-banner {
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.3);
          border-radius: 12px; padding: 12px 14px;
          display: flex; gap: 10px; margin-bottom: 20px;
          align-items: flex-start;
        }
        .demo-banner__icon { color: #60a5fa; margin-top: 1px; flex-shrink: 0; }
        .demo-banner__label { font-size: 11px; font-weight: 700; color: #60a5fa;
          text-transform: uppercase; letter-spacing: 0.5px; }
        .demo-banner__otp { font-size: 22px; font-weight: 800; color: #fff;
          letter-spacing: 6px; margin-top: 2px; }

        /* OTP boxes */
        .otp-boxes { display: flex; gap: 8px; justify-content: center; margin-bottom: 24px; }
        .otp-box {
          width: 44px; height: 52px; text-align: center; font-size: 22px;
          font-weight: 700; color: #f1f5f9;
          background: rgba(255,255,255,0.06);
          border: 1.5px solid rgba(255,255,255,0.12);
          border-radius: 12px; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          caret-color: #3b82f6;
        }
        .otp-box:focus {
          border-color: #3b82f6; box-shadow: 0 0 0 3px #3b82f625;
        }

        /* back link */
        .auth-back {
          background: none; border: none; color: #475569;
          font-size: 13px; cursor: pointer;
          display: flex; align-items: center; gap: 4px;
          margin: 0 auto; transition: color 0.2s;
          padding: 0;
        }
        .auth-back:hover { color: #94a3b8; }

        /* footer pills */
        .auth-pills {
          display: flex; gap: 12px; margin-top: 28px; justify-content: center;
        }
        .auth-pill {
          display: flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px; padding: 6px 14px;
          color: #475569; font-size: 12px;
        }
        .auth-pill svg { width: 13px; height: 13px; color: #3b82f6; }
      `}</style>

      <div className="auth-root">
        {/* blobs */}
        <div className="auth-blob auth-blob--a" />
        <div className="auth-blob auth-blob--b" />
        <div className="auth-blob auth-blob--c" />

        {/* logo */}
        <div className="auth-logo">
          <div className="auth-logo__icon">
            <MapPin color="#fff" size={26} />
          </div>
          <span className="auth-logo__text">
            Easy<span>Park</span>
          </span>
        </div>
        <p className="auth-tagline">Smart parking at your fingertips</p>

        {/* card */}
        <div className="auth-card">

          {step === 'form' ? (
            <>
              {/* tab switcher */}
              <div className="auth-tabs" role="tablist">
                <button
                  role="tab"
                  className={`auth-tab${tab === 'login' ? ' active' : ''}`}
                  onClick={() => switchTab('login')}
                >
                  Login
                </button>
                <button
                  role="tab"
                  className={`auth-tab${tab === 'signup' ? ' active' : ''}`}
                  onClick={() => switchTab('signup')}
                >
                  Sign Up
                </button>
              </div>

              {/* heading */}
              {tab === 'login' ? (
                <>
                  <p className="auth-heading">Welcome back 👋</p>
                  <p className="auth-sub">Sign in to continue to your account</p>
                </>
              ) : (
                <>
                  <p className="auth-heading">Create account 🚀</p>
                  <p className="auth-sub">Join EasyPark and find parking in seconds</p>
                </>
              )}

              <form onSubmit={handleSubmit}>
                {/* name — signup only */}
                {tab === 'signup' && (
                  <Field
                    label="Full Name"
                    icon={User}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                  />
                )}

                <Field
                  label="Mobile Number"
                  icon={Phone}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit number"
                  maxLength={10}
                />

                <Field
                  label="Password"
                  icon={Lock}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tab === 'signup' ? 'Min. 6 characters' : 'Enter your password'}
                />

                {/* confirm password — signup only */}
                {tab === 'signup' && (
                  <Field
                    label="Confirm Password"
                    icon={Lock}
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Re-enter password"
                  />
                )}

                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? (
                    <div className="auth-spinner" />
                  ) : (
                    <>
                      {tab === 'login' ? 'Login & Verify' : 'Create Account'}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              <div className="auth-divider">
                {tab === 'login'
                  ? "Don't have an account?"
                  : 'Already have an account?'}
              </div>
              <button
                className="auth-btn"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  boxShadow: 'none',
                  border: '1px solid rgba(255,255,255,0.1)',
                  marginTop: 0,
                }}
                onClick={() => switchTab(tab === 'login' ? 'signup' : 'login')}
              >
                {tab === 'login' ? 'Create New Account' : 'Sign In Instead'}
              </button>
            </>
          ) : (
            /* ── OTP step ── */
            <>
              <button className="auth-back" onClick={() => setStep('form')}>
                <ChevronLeft size={16} />
                Back
              </button>

              <div style={{ marginTop: 16, marginBottom: 8 }}>
                <p className="auth-heading">Verify your number</p>
                <p className="auth-sub">
                  Enter the 6-digit code sent to{' '}
                  <strong style={{ color: '#94a3b8' }}>+91 {phone}</strong>
                </p>
              </div>

              {/* demo OTP banner */}
              {demoOtp && (
                <div className="demo-banner">
                  <Info size={15} className="demo-banner__icon" />
                  <div>
                    <p className="demo-banner__label">Demo Mode — Your OTP</p>
                    <p className="demo-banner__otp">{demoOtp}</p>
                  </div>
                </div>
              )}

              <OtpBoxes onComplete={handleVerify} disabled={loading} />

              {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <div className="auth-spinner" style={{ borderTopColor: '#3b82f6', borderColor: '#1e3a5f' }} />
                </div>
              )}
            </>
          )}
        </div>

        {/* footer pills */}
        <div className="auth-pills">
          {[
            { icon: Shield, label: 'Secure' },
            { icon: MapPin, label: 'GPS-Based' },
            { icon: Phone, label: 'OTP Verified' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="auth-pill">
              <Icon />
              {label}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
