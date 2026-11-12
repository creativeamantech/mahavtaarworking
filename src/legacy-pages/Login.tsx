import { useState } from 'react';
import { useNavigate } from '@/lib/router-compat';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Hexagon, CheckCircle2 } from 'lucide-react';

const EXECUTIVE_NAMES = [
  'Aarti', 'Admin', 'Ankita', 'Bharti', 'Julee',
  'Pooja', 'Shikha', 'Sona', 'Sunanda', 'Vinita',
] as const;

export default function Login() {
  const [executiveName, setExecutiveName] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!executiveName || !pin || loading) return;
    setError('');
    setLoading(true);
    try {
      const user = await login(executiveName, pin);
      setPin('');
      navigate(user.role === 'EXECUTIVE' ? '/exec-dashboard' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:flex w-[60%] bg-sidebar flex-col justify-center px-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="z-10 max-w-lg">
          <div className="relative flex h-20 w-20 items-center justify-center text-accent mb-8">
            <Hexagon className="absolute inset-0 h-full w-full fill-accent/10 stroke-accent stroke-[1.5]" />
            <span className="z-10 font-sans text-4xl font-bold text-accent">M</span>
          </div>
          <h1 className="font-sans text-5xl font-extrabold tracking-tight text-white mb-4">MAHAVTAAR</h1>
          <h2 className="font-sans text-2xl font-medium tracking-widest text-white/50 uppercase mb-12">Working</h2>
          <div className="space-y-6">
            {['Live workspace data', 'Team and portfolio reports', 'Secure server-side sessions', 'Role-based access control'].map((feature) => (
              <div key={feature} className="flex items-center gap-4 text-white/80">
                <CheckCircle2 className="h-6 w-6 text-accent shrink-0" />
                <span className="font-sans text-lg">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-background w-full lg:w-[40%] p-4">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none hidden sm:block" />
        <div className="absolute bottom-1/4 -right-1/4 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[120px] pointer-events-none hidden sm:block" />
        <div className="w-full max-w-[420px] z-10">
          <div className="mb-8 text-center flex flex-col items-center lg:hidden">
            <div className="relative flex h-14 w-14 items-center justify-center text-primary mb-4">
              <Hexagon className="absolute inset-0 h-full w-full fill-primary/10 stroke-primary stroke-[1.5]" />
              <span className="z-10 font-sans text-2xl font-bold text-primary">M</span>
            </div>
            <h1 className="font-sans text-2xl font-extrabold uppercase tracking-widest text-primary mb-1">Mahavtaar</h1>
            <h2 className="font-sans text-xs font-medium tracking-[0.3em] text-muted-foreground uppercase">Working</h2>
          </div>

          <form onSubmit={handleSubmit} className="bg-card/50 backdrop-blur-md border border-border/50 shadow-xl rounded-2xl p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="mb-8">
              <h3 className="text-2xl font-bold tracking-tight">Welcome back</h3>
              <p className="text-sm text-muted-foreground mt-1">Select your profile and enter your PIN.</p>
            </div>

            <div className="mb-5">
              <label htmlFor="executive-name" className="mb-2 block font-sans text-xs font-bold uppercase tracking-widest text-muted-foreground">Executive name</label>
              <select
                id="executive-name"
                required
                value={executiveName}
                onChange={(e) => setExecutiveName(e.target.value)}
                disabled={loading}
                className="h-11 w-full rounded-md border border-input bg-background/50 px-4 font-sans text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              >
                <option value="">Select executive</option>
                {EXECUTIVE_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>

            <div className="mb-6">
              <label htmlFor="login-pin" className="mb-2 block font-sans text-xs font-bold uppercase tracking-widest text-muted-foreground">PIN</label>
              <div className="relative">
                <input
                  id="login-pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  disabled={loading}
                  required
                  className="h-11 w-full rounded-md border border-input bg-background/50 px-4 pr-11 font-sans text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  placeholder="Enter your PIN"
                />
                <button type="button" onClick={() => setShowPin((s) => !s)} aria-label={showPin ? 'Hide PIN' : 'Show PIN'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors p-1">
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <div role="alert" className="mb-5 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive font-medium text-center">{error}</div>}

            <button type="submit" disabled={!executiveName || !pin || loading} className="flex h-12 w-full items-center justify-center rounded-md bg-primary font-sans text-sm font-bold uppercase tracking-widest text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50">
              {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : 'Continue'}
            </button>
            <p className="mt-6 text-center text-xs text-muted-foreground/70">Secure access for authorised team members</p>
          </form>
        </div>
      </div>
    </div>
  );
}
