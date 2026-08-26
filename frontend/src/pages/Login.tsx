import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../store/auth';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@digitalsofts.com' },
  { role: 'Manager', email: 'manager@digitalsofts.com' },
  { role: 'Employee', email: 'employee@digitalsofts.com' },
  { role: 'Readonly', email: 'viewer@digitalsofts.com' },
];

export default function Login() {
  const [email, setEmail] = useState('admin@digitalsofts.com');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuth((s) => s.setAuth);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      setAuth(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.name}`);
      navigate('/board');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="h-10 w-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-lg">D</div>
          <div className="text-left">
            <div className="font-semibold leading-tight">DigitalSofts</div>
            <div className="text-xs text-slate-500 leading-tight">Operations & Workflow Platform</div>
          </div>
        </div>

        <div className="card p-7">
          <h1 className="text-lg font-semibold mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 mb-5">Use a demo account below or your own credentials.</p>

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Email</label>
              <input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Password</label>
              <input className="input mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
              <Sparkles size={16} />
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="text-xs font-medium text-slate-500 mb-2">Demo accounts (password: Password123!)</div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword('Password123!');
                  }}
                  className="text-xs rounded-lg border border-slate-200 px-2 py-1.5 hover:bg-slate-50 text-left"
                >
                  <div className="font-medium">{acc.role}</div>
                  <div className="text-slate-400 truncate">{acc.email}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
