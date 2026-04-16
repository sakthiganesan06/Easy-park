import { createContext, useContext, useState, useEffect } from 'react';
import { signupUser, loginUser } from '../lib/parkingApi';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ─── local session helpers ────────────────────────────────────────────────────
const SESSION_KEY = 'easypark_session';

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}

function saveSession(user) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
}
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [pendingOtp, setPendingOtp]   = useState('');
  const [otpTarget, setOtpTarget]     = useState(null); // { dbUser, mode }

  // Restore session on mount
  useEffect(() => {
    const stored = getSession();
    if (stored) setUser(stored);
    setLoading(false);
  }, []);

  // Persist session whenever user changes
  useEffect(() => { saveSession(user); }, [user]);

  /** Generates a 6-digit demo OTP */
  const _generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

  // ─────────────────────────────────────────────────────────────────────────
  // SIGN UP  — validates in Supabase, saves hashed password, sends OTP
  // ─────────────────────────────────────────────────────────────────────────
  const signup = async (name, phone, password) => {
    try {
      // Save to Supabase (throws on duplicate phone or DB error)
      const dbUser = await signupUser(name, phone, password);

      const otp = _generateOtp();
      console.log(`🔑 Signup OTP for ${phone}: ${otp}`);

      setPendingOtp(otp);
      setOtpTarget({ dbUser, mode: 'signup' });

      return { success: true, otp };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // LOGIN — verifies credentials against Supabase, sends OTP
  // ─────────────────────────────────────────────────────────────────────────
  const login = async (phone, password) => {
    try {
      // Fetches from Supabase & compares SHA-256 hash (throws on mismatch)
      const dbUser = await loginUser(phone, password);

      const otp = _generateOtp();
      console.log(`🔑 Login OTP for ${phone}: ${otp}`);

      setPendingOtp(otp);
      setOtpTarget({ dbUser, mode: 'login' });

      return { success: true, otp };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // VERIFY OTP — shared for both login & signup
  // ─────────────────────────────────────────────────────────────────────────
  const verifyOTP = async (code) => {
    await new Promise((r) => setTimeout(r, 800));

    if (code !== pendingOtp) {
      return { success: false, error: 'Invalid OTP. Please try again.' };
    }

    const { dbUser } = otpTarget;

    // Build session object from Supabase row
    const newUser = {
      id:            dbUser.id,
      name:          dbUser.name,
      phone:         dbUser.phone,
      walletBalance: dbUser.wallet_balance ?? 500,
      createdAt:     dbUser.created_at,
      pendingFine:   0,   // ₹10 fine from overstay, cleared on next payment
    };

    setUser(newUser);
    setPendingOtp('');
    setOtpTarget(null);

    return { success: true };
  };

  // ─────────────────────────────────────────────────────────────────────────
  const logout = () => {
    setUser(null);
    setPendingOtp('');
    setOtpTarget(null);
    saveSession(null);
  };

  const updateWallet = (amount) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, walletBalance: prev.walletBalance + amount };
      saveSession(updated);
      return updated;
    });
  };

  /** Set (or add to) the pending fine amount for this user's next booking. */
  const applyPendingFine = (amount) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, pendingFine: (prev.pendingFine || 0) + amount };
      saveSession(updated);
      return updated;
    });
  };

  /** Clear the pending fine after it has been charged. */
  const clearPendingFine = () => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, pendingFine: 0 };
      saveSession(updated);
      return updated;
    });
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    pendingOtp,
    signup,
    login,
    verifyOTP,
    logout,
    updateWallet,
    applyPendingFine,
    clearPendingFine,
    // backward-compat aliases
    sendOTP: null,
    generatedOtp: pendingOtp,
    otpSent: !!pendingOtp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
