import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, UserCog, Users, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { fetchCartFromServer } from '../../stores/syncCart';
import { api } from '../../api';
import { Card, Input, Button } from '../../components/ui';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState('customer'); // customer, staff, register
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (location.pathname === '/admin/login') {
      setActiveTab('staff');
    }
  }, [location.pathname]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
      if (activeTab === 'customer') {
        const res = await api.post('/api/method/hospital_pharmacy.api.customer_login', { email: data.email, password: data.password });
        if(res.data.message.status === 'success') {
          login(res.data.message.user, res.data.message.full_name, false);
          await fetchCartFromServer();
          navigate('/');
        }
      } else if (activeTab === 'staff') {
        const res = await api.post('/api/method/hospital_pharmacy.api.admin_login', { email: data.email, password: data.password });
        if(res.data.message.status === 'success') {
          login(res.data.message.user, res.data.message.full_name, true);
          navigate('/admin');
        }
      } else if (activeTab === 'register') {
        if (data.password !== data.confirm_password) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        const res = await api.post('/api/method/hospital_pharmacy.api.register_customer', { 
          full_name: data.full_name, 
          email: data.email, 
          phone: data.phone,
          password: data.password 
        });
        if(res.data.message.status === 'success') {
          setActiveTab('customer');
        }
      }
    } catch (err) {
      let errorMsg = 'Authentication failed';
      if (err.response?.data?._server_messages) {
        try {
          const messages = JSON.parse(err.response.data._server_messages);
          errorMsg = JSON.parse(messages[0]).message || errorMsg;
        } catch (e) {
          errorMsg = err.response.data.exc_type || errorMsg;
        }
      } else {
        errorMsg = err.response?.data?.exc_type || errorMsg;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side: Form (Customer / Admin / Register) */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:px-24 xl:px-32 relative">
        <Link to="/" className="absolute top-8 left-8 sm:left-12 lg:left-24 xl:left-32 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        
        <div className="max-w-md w-full mx-auto">
          <div className="mb-10">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              {activeTab === 'customer' && 'Welcome Back'}
              {activeTab === 'staff' && 'Staff Portal'}
              {activeTab === 'register' && 'Create Account'}
            </h1>
            <p className="text-slate-500 font-medium mt-2">
              {activeTab === 'customer' && 'Enter your details to access your account'}
              {activeTab === 'staff' && 'Secure access for hospital personnel'}
              {activeTab === 'register' && 'Join us to manage your healthcare needs'}
            </p>
          </div>

          <div className="flex bg-slate-50 border border-slate-100 rounded-xl p-1 mb-8 shadow-inner">
            {[
              { id: 'customer', label: 'Customer', icon: Users },
              { id: 'register', label: 'Register', icon: ShieldCheck },
              { id: 'staff', label: 'Staff', icon: UserCog }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setActiveTab(t.id); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
                  activeTab === t.id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <t.icon className="w-4 h-4" /> <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-6 px-5 py-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {activeTab === 'register' && (
              <>
                <Input name="full_name" type="text" placeholder="John Doe" label="Full Name" required />
                <Input name="phone" type="tel" placeholder="10-digit mobile number" label="Phone Number" required pattern="[0-9]{10}" />
              </>
            )}
            
            <Input name="email" type={activeTab === 'staff' ? 'text' : 'email'} placeholder={activeTab === 'staff' ? 'enter username or email' : 'enter email'} label={activeTab === 'staff' ? 'Username / Email' : 'Email Address'} required />
            <Input name="password" type="password" placeholder="••••••••" label="Password" required minLength={6} />
            
            {activeTab === 'register' && (
              <Input name="confirm_password" type="password" placeholder="••••••••" label="Confirm Password" required minLength={6} />
            )}

            <Button type="submit" size="lg" isLoading={loading} className="w-full mt-4 h-14">
              {activeTab === 'customer' && 'Sign In'}
              {activeTab === 'staff' && 'Authenticate Staff'}
              {activeTab === 'register' && 'Create Account'}
            </Button>
          </form>

          {activeTab !== 'staff' && (
            <p className="mt-8 text-center text-sm font-medium text-slate-500">
              {activeTab === 'customer' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setActiveTab(activeTab === 'customer' ? 'register' : 'customer'); setError(''); }}
                className="text-blue-600 font-bold hover:underline"
              >
                {activeTab === 'customer' ? 'Register' : 'Sign In'}
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Right Side: Medical Illustration / Branding */}
      <div className="hidden lg:flex flex-1 flex-col bg-gradient-to-br from-blue-600 to-indigo-700 p-12 text-white justify-center items-center relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white opacity-5 rounded-full blur-3xl -mr-40 -mt-40" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-400 opacity-20 rounded-full blur-3xl -ml-20 -mb-20" />
        
        <div className="relative z-10 max-w-lg text-center">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-2xl mx-auto mb-10">
            <span className="text-blue-600 text-3xl font-black">Rx</span>
          </div>
          <h2 className="text-5xl font-black leading-tight mb-6 tracking-tight">Premium Pharmacy Care.</h2>
          <p className="text-blue-100 text-lg font-medium leading-relaxed mb-12">
            Experience the future of healthcare. Get genuine medicines delivered to your doorstep securely and track your orders in real-time.
          </p>
          
          <div className="flex items-center justify-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <span className="text-sm font-bold text-blue-100">100% Secure</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                <Users className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-bold text-blue-100">Expert Care</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
