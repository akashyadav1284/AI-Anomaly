import React, { useState } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { BigBrandLogo } from './brand/BigBrandLogo';
import { BrandLogo } from './brand/BrandLogo';
import { SensorCanvasIllustration } from './brand/SensorCanvasIllustration';
import { SensorWaveBackground } from './decorations/SensorWaveBackground';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { UserSession } from '../services/auth';

interface LoginPageProps {
  onSuccess: (session: UserSession) => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Copy feedback states
  const [copiedUser, setCopiedUser] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  // Check if Demo Login is enabled via explicit environment variable or local dev
  const isDemoEnabled =
    import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true' ||
    import.meta.env.MODE === 'development' ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('vercel.app')));

  const handleCopy = (text: string, type: 'user' | 'pass') => {
    navigator.clipboard.writeText(text);
    if (type === 'user') {
      setCopiedUser(true);
      setTimeout(() => setCopiedUser(false), 2000);
    } else {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  const handleFillDemoCredentials = () => {
    setUserId('cse276');
    setPassword('1234');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedUser = userId.trim();
    if (!trimmedUser || !password) {
      setErrorMsg('Please enter both User ID and Pass key.');
      return;
    }

    setLoading(true);

    // Controlled Demo Authentication Validation
    setTimeout(() => {
      if (isDemoEnabled && trimmedUser === 'cse276' && password === '1234') {
        const session: UserSession = {
          userId: trimmedUser,
          authenticatedAt: new Date().toISOString(),
          isDemo: true,
        };
        onSuccess(session);
      } else {
        setErrorMsg('Invalid User ID or Pass key. Please verify authorized credentials.');
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8F9FA] text-slate-900 font-sans relative overflow-hidden p-4 sm:p-6 lg:p-10 select-none">
      {/* Background Decorative Lattice */}
      <SensorWaveBackground opacity={0.5} />

      {/* Main Two-Column Architectural Container */}
      <div className="w-full max-w-5xl bg-white border border-slate-200/90 rounded-2xl shadow-card overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 transition-all duration-300">
        {/* LEFT PANEL — Brand Identity & Vision */}
        <div className="lg:col-span-6 p-8 sm:p-12 bg-slate-50/70 border-b lg:border-b-0 lg:border-r border-slate-200/80 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Canvas Network Pulse Background */}
          <div className="absolute inset-0 opacity-40">
            <SensorCanvasIllustration />
          </div>

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-[10px] font-mono tracking-wider uppercase bg-white border-blue-200 text-blue-700">
                <Sparkles className="w-3 h-3 mr-1 text-blue-600" />
                AI-Powered Telemetry Intelligence
              </Badge>
            </div>

            {/* BIG Custom Logo Focal Point */}
            <div className="pt-2">
              <BigBrandLogo size={84} />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                AI - Guard
              </h1>
              <p className="text-sm font-semibold text-blue-600 tracking-tight">
                See the signal. Detect the anomaly.
              </p>
              <p className="text-xs text-slate-500 leading-relaxed max-w-md pt-1">
                Intelligent telemetry monitoring, real-time anomaly detection, and research-driven insights — all in one unified workspace.
              </p>
            </div>
          </div>

          {/* Inspirational Philosophy Quote */}
          <div className="relative z-10 pt-10 mt-6 border-t border-slate-200/80">
            <blockquote className="text-xs italic text-slate-600 leading-relaxed">
              “In every signal, there is a story. In every anomaly, an opportunity to understand.”
            </blockquote>
            <div className="mt-2 text-[10px] uppercase font-mono tracking-wider text-slate-400">
              Sensor Research & Operational Guard
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Interactive Login Form */}
        <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto space-y-6">
            {/* Form Header */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <BrandLogo size={24} pulse={false} />
                <span className="text-xs font-bold text-slate-800 tracking-tight">
                  AI - Guard
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Welcome back
              </h2>
              <p className="text-xs text-slate-500">
                Sign in to access your telemetry workspace.
              </p>
            </div>

            {/* Error Message Box */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-200">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  User ID
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter your user ID"
                  className="w-full bg-slate-50 text-xs text-slate-900 rounded-lg px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono"
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Pass key
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter pass key"
                    className="w-full bg-slate-50 text-xs text-slate-900 rounded-lg px-3.5 py-2.5 pr-10 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide pass key' : 'Show pass key'}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberSession}
                    onChange={(e) => setRememberSession(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Remember session</span>
                </label>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs h-10 shadow-subtle flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating Workspace...
                  </span>
                ) : (
                  <>
                    Sign In to Console
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </form>

            {/* DEMO ACCESS — TESTER CREDENTIALS BOX */}
            {isDemoEnabled && (
              <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200/90 text-xs space-y-3 shadow-subtle">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                    Demo Access — Tester Credentials
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border-emerald-200">
                    TESTER
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {/* User ID Box */}
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">User ID</span>
                      <span className="font-bold text-slate-800 text-xs">cse276</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('cse276', 'user')}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Copy User ID"
                    >
                      {copiedUser ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Pass key Box */}
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Pass key</span>
                      <span className="font-bold text-slate-800 text-xs">1234</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('1234', 'pass')}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Copy Pass key"
                    >
                      {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400 italic">
                    For authorized project testing only
                  </span>
                  <button
                    type="button"
                    onClick={handleFillDemoCredentials}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Use demo credentials
                  </button>
                </div>
              </div>
            )}

            <div className="text-center text-[11px] text-slate-400 pt-2">
              Built for intelligent monitoring and reliable detection.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
