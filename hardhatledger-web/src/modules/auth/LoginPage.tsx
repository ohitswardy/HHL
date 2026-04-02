import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import toast from 'react-hot-toast';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('Welcome to HardhatLedger!');
      navigate('/dashboard');
    } catch {
      toast.error('Invalid email or password.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy via-navy-dark to-navy p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber rounded-2xl mb-4 shadow-lg">
            <span className="text-navy-dark font-black text-2xl">H</span>
          </div>
          <h1 className="text-3xl font-bold text-white">HardhatLedger</h1>
          <p className="text-white/60 mt-1">Construction Materials Management</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-navy-dark mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@hardhatledger.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
            <Button type="submit" loading={isLoading} className="w-full" size="lg" variant="amber">
              Sign In
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              HardhatLedger v1.0 - Unified Business System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
