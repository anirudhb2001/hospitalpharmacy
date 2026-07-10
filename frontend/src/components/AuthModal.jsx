import React, { useState } from 'react';
import { Modal, Input, Button } from './ui';
import { useAuthStore } from '../stores/useAuthStore';
import { useCartStore } from '../stores/useCartStore';
import { authService, parseFrappeError } from '../services';
import { useNavigate } from 'react-router-dom';
import { X, ShieldCheck } from 'lucide-react';

const TABS = ['login', 'register'];

export default function AuthModal({ isOpen, onClose, onSuccess, defaultTab = 'login' }) {
  const [tab, setTab] = useState(defaultTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const f = e.target;

    try {
      if (tab === 'login') {
        const res = await authService.customerLogin(f.email.value, f.password.value);
        login(res.user, res.full_name, false);
      } else {
        if (f.password.value !== f.confirm.value) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        await authService.register(f.full_name.value, f.email.value, f.phone.value, f.password.value);
        const res = await authService.customerLogin(f.email.value, f.password.value);
        login(res.user, res.full_name, false);
      }
      
      onClose();
      onSuccess?.();
      
      const { pendingAction, clearPendingAction } = useAuthStore.getState();
      if (pendingAction) {
        if (pendingAction.type === 'buy_now') {
          useCartStore.getState().addItem(pendingAction.payload);
          navigate('/cart');
        } else if (pendingAction.type === 'add_to_cart') {
          useCartStore.getState().addItem(pendingAction.payload);
          import('react-hot-toast').then(({ toast }) => toast.success(`${pendingAction.payload.medicine_name} added to cart!`));
        }
        clearPendingAction();
      }
    } catch (err) {
      setError(parseFrappeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-4xl w-[95%] md:w-[800px] p-0 overflow-hidden">
      <div className="flex flex-col md:flex-row max-h-[90vh]">
        
        {/* Left Side Branding (Hidden on small screens) */}
        <div className="hidden md:flex flex-col bg-gradient-to-br from-blue-600 to-indigo-700 w-2/5 p-8 text-white justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400 opacity-20 rounded-full blur-3xl -ml-10 -mb-10" />
          
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg mb-6">
              <span className="text-blue-600 text-xl font-black">Rx</span>
            </div>
            <h2 className="text-3xl font-black leading-tight mb-4 tracking-tight">Premium<br/>Pharmacy<br/>Care.</h2>
            <p className="text-blue-100 font-medium">Get genuine medicines delivered to your doorstep securely.</p>
          </div>
          
          <div className="relative z-10 mt-10">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-100 bg-white/10 px-4 py-2 rounded-full backdrop-blur-md w-fit">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> 100% Secure
            </div>
          </div>
        </div>

        {/* Right Side Form */}
        <div className="w-full md:w-3/5 p-8 md:p-10 bg-white overflow-y-auto">
          <div className="flex justify-end mb-4">
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {tab === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-slate-500 font-medium mt-2">
              {tab === 'login' ? 'Enter your details to access your account' : 'Join us to manage your orders securely'}
            </p>
          </div>

          <div className="flex bg-slate-50 border border-slate-100 rounded-xl p-1 mb-8 shadow-inner">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all capitalize ${
                  tab === t ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-6 px-5 py-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {tab === 'register' && (
              <>
                <Input name="full_name" type="text" placeholder="John Doe" label="Full Name" required />
                <Input name="phone" type="tel" placeholder="10-digit mobile number" label="Phone Number" required pattern="[0-9]{10}" />
              </>
            )}
            <Input name="email" type="text" placeholder="Email or Username" label="Email Address or Username" required />
            <Input name="password" type="password" placeholder="••••••••" label="Password" required minLength={6} />
            
            {tab === 'register' && (
              <Input name="confirm" type="password" placeholder="••••••••" label="Confirm Password" required minLength={6} />
            )}

            <Button type="submit" variant="primary" size="lg" isLoading={loading} className="w-full mt-4 h-14">
              {tab === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm font-medium text-slate-500">
            {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-blue-600 font-bold hover:underline"
            >
              {tab === 'login' ? 'Register' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </Modal>
  );
}
