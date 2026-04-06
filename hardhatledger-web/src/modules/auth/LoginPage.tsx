import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mounted, setMounted] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [shake, setShake] = useState(false);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      setIsSuccess(true);
      toast.success('Welcome to HardhatLedger!');
      setTimeout(() => navigate('/dashboard'), 800);
    } catch {
      setShake(true);
      toast.error('Invalid email or password.');
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="nl-scene">
      {/* Ambient floating orbs */}
      <div className="nl-orb nl-orb-1" />
      <div className="nl-orb nl-orb-2" />
      <div className="nl-orb nl-orb-3" />
      <div className="nl-grid" />

      <div className={`nl-card${mounted ? ' nl-card--in' : ''}${shake ? ' nl-shake' : ''}`}>
        {/* Branding */}
        <div className="nl-logo-section">
          <img
            src="/HHLicon.png"
            alt="HardhatLedger mascot"
            style={{ width: 96, height: 96, objectFit: 'contain', display: 'block', margin: '0 auto 8px' }}
          />
          <h1 className="nl-brand">HardhatLedger</h1>
          <p className="nl-subtitle">Construction Materials Management</p>
        </div>

        <div className="nl-divider" />

        {/* Glass sign-in panel */}
        <div className="nl-glass">
          <h2 className="nl-glass-title">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="nl-form">
            <div className="nl-field">
              <label className="nl-label" htmlFor="nl-email">Email Address</label>
              <div className="nl-input-shell">
                <input
                  id="nl-email"
                  type="email"
                  className="nl-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@hardhatledger.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="nl-field">
              <label className="nl-label" htmlFor="nl-password">Password</label>
              <div className="nl-input-shell">
                <input
                  id="nl-password"
                  type="password"
                  className="nl-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || isSuccess}
              className={`nl-cta${isSuccess ? ' nl-cta--success' : ''}`}
            >
              {isLoading ? (
                <span className="nl-spinner" />
              ) : isSuccess ? (
                <svg className="nl-check" viewBox="0 0 24 24" width="24" height="24">
                  <polyline
                    points="4 12 10 18 20 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="nl-version">HardhatLedger v1.0 — Unified Business System</p>
      </div>
    </div>
  );
}
