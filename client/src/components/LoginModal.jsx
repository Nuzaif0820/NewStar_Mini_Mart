import React, { useState } from 'react';
import { Lock, User, KeyRound, ShieldCheck, Sparkles, ShoppingBag } from 'lucide-react';
import { api } from '../utils/api';
import { playBeep } from '../utils/sound';

export default function LoginModal({ onLoginSuccess }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleKeypadPress = (val) => {
    if (pin.length < 6) {
      setPin(prev => prev + val);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handlePinSubmit = async (pinToTry = pin) => {
    if (!pinToTry) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/api/auth/login', { pin: pinToTry });
      if (res.success && res.user) {
        playBeep('success');
        localStorage.setItem('nmart_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
      } else {
        playBeep('error');
        setError(res.error || 'Invalid PIN code');
        setPin('');
      }
    } catch (err) {
      playBeep('error');
      setError('Connection failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center">
        {/* N Mart Shop Logo & Title */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-white p-2 shadow-xl border border-slate-700 flex items-center justify-center mb-3">
            <img src="/logo.png" alt="N Mart" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">N MART POS & INVENTORY</h1>
          <p className="text-xs text-slate-400 mt-0.5">Please enter your 4-digit terminal PIN</p>
        </div>

        {/* PIN Display Dots */}
        <div className="flex items-center justify-center gap-3 my-2">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                pin.length > idx
                  ? 'bg-emerald-400 border-emerald-400 shadow-[0_0_10px_#34d399]'
                  : 'border-slate-700 bg-slate-800'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="text-xs font-semibold text-rose-400 my-2 text-center animate-shake">
            {error}
          </div>
        )}

        {/* Numeric PIN Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full my-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleKeypadPress(String(num))}
              className="py-3 bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 rounded-2xl text-lg font-bold text-white transition shadow-sm"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="py-3 bg-slate-800/60 hover:bg-slate-700 rounded-2xl text-xs font-bold text-slate-400 transition"
          >
            CLEAR
          </button>
          <button
            onClick={() => handleKeypadPress('0')}
            className="py-3 bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 rounded-2xl text-lg font-bold text-white transition shadow-sm"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="py-3 bg-slate-800/60 hover:bg-slate-700 rounded-2xl text-xs font-bold text-slate-400 transition"
          >
            ⌫
          </button>
        </div>

        {/* Submit Button */}
        <button
          onClick={() => handlePinSubmit()}
          disabled={loading || pin.length < 4}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-2xl text-sm transition shadow-lg shadow-emerald-900/40"
        >
          {loading ? 'Authenticating...' : 'Unlock Terminal'}
        </button>

        {/* Security Notice */}
        <div className="w-full mt-6 pt-4 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-medium">
            <Lock className="w-3 h-3 text-emerald-400" /> Authorized Shop Personnel Only
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">
            Owner & Staff accounts use individual PINs configured in Settings
          </p>
        </div>
      </div>
    </div>
  );
}
