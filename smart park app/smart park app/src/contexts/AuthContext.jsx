import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');

  // Load persisted user on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('easypark_user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load user:', e);
    }
    setLoading(false);
  }, []);

  // Persist user changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('easypark_user', JSON.stringify(user));
    }
  }, [user]);

  /**
   * Send OTP to phone number (simulated)
   * In production, this would use Firebase Phone Auth
   */
  const sendOTP = async (name, phone) => {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 1500));
    
    // Generate a 6-digit OTP (in prod this would come from Firebase)
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedOtp(otp);
    setOtpSent(true);
    
    // Store name temporarily
    localStorage.setItem('easypark_temp_name', name);
    localStorage.setItem('easypark_temp_phone', phone);

    // Log OTP to console for demo purposes
    console.log(`🔑 OTP for ${phone}: ${otp}`);
    
    return { success: true, otp }; // Return OTP for demo display
  };

  /**
   * Verify OTP (simulated)
   */
  const verifyOTP = async (code) => {
    await new Promise((r) => setTimeout(r, 1000));

    if (code === generatedOtp) {
      const name = localStorage.getItem('easypark_temp_name') || 'User';
      const phone = localStorage.getItem('easypark_temp_phone') || '';
      
      const newUser = {
        id: `user-${Date.now()}`,
        name,
        phone,
        walletBalance: 500,
        createdAt: new Date().toISOString(),
      };

      setUser(newUser);
      setOtpSent(false);
      setGeneratedOtp('');
      localStorage.removeItem('easypark_temp_name');
      localStorage.removeItem('easypark_temp_phone');

      return { success: true };
    }

    return { success: false, error: 'Invalid OTP. Please try again.' };
  };

  const logout = () => {
    setUser(null);
    setOtpSent(false);
    setGeneratedOtp('');
    localStorage.removeItem('easypark_user');
  };

  const updateWallet = (amount) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, walletBalance: prev.walletBalance + amount };
      localStorage.setItem('easypark_user', JSON.stringify(updated));
      return updated;
    });
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    otpSent,
    generatedOtp, // Exposed for demo display
    sendOTP,
    verifyOTP,
    logout,
    updateWallet,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
