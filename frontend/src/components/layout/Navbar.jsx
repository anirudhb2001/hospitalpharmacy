import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, LogOut, Search, Pill, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCartStore } from '../../stores/useCartStore';
import { SearchBar, Button } from '../ui';

export const Navbar = ({ onOpenAuthModal }) => {
  const { isAuthenticated, fullName, logout } = useAuthStore();
  const { getItemCount } = useCartStore();
  const navigate = useNavigate();

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      window.dispatchEvent(new CustomEvent('set-medicine-search', { detail: e.target.value }));
      if (window.location.pathname !== '/medicines' && window.location.pathname !== '/') {
        navigate('/medicines');
      }
      setTimeout(() => {
        window.scrollTo({ top: document.getElementById('medicine-grid')?.offsetTop - 100, behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-white shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Top Info Bar */}
        <div className="hidden md:flex items-center justify-between py-2 border-b border-slate-100 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> 100% Genuine Medicines</span>
            <span className="flex items-center gap-1.5"><Pill className="w-3.5 h-3.5 text-blue-500" /> Trusted Pharmacy</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-blue-600 transition-colors">Download App</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Need Help?</a>
            <Link to="/admin/login" className="hover:text-blue-600 transition-colors">Admin Portal</Link>
          </div>
        </div>

        {/* Main Navbar */}
        <div className="flex items-center justify-between gap-6 py-4">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform duration-300">
              <span className="text-white text-sm font-black">Rx</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-black text-slate-900 text-xl leading-none tracking-tight">Hospital<span className="text-blue-600">Pharmacy</span></h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Premium Healthcare</p>
            </div>
          </Link>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:block flex-1 max-w-xl mx-8">
            <SearchBar placeholder="Search for medicines, health products... (Press Enter)" onKeyDown={handleSearch} />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3 md:gap-5 shrink-0">
            
            <nav className="hidden lg:flex items-center gap-6 mr-2 font-bold text-sm text-slate-600">
              <Link to="/medicines" onClick={() => {
                window.dispatchEvent(new CustomEvent('clear-medicine-filters'));
                setTimeout(() => {
                  window.scrollTo({ top: document.getElementById('medicine-grid')?.offsetTop - 100, behavior: 'smooth' });
                }, 100);
              }} className="hover:text-blue-600 transition-colors">Medicines</Link>
              {isAuthenticated && (
                <Link to="/orders" className="hover:text-blue-600 transition-colors">My Orders</Link>
              )}
            </nav>

            <Link to="/cart" className="relative group">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm flex items-center justify-center group-hover:bg-blue-50 group-hover:border-blue-200 group-hover:text-blue-600 transition-all duration-300">
                <ShoppingCart className="w-5 h-5 text-slate-600 group-hover:text-blue-600 transition-colors" />
              </div>
              {getItemCount() > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white text-[11px] font-black rounded-full flex items-center justify-center shadow-md shadow-rose-500/30 border-2 border-white transform group-hover:scale-110 transition-transform">
                  {getItemCount()}
                </span>
              )}
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link to="/profile" className="hidden sm:flex items-center gap-2.5 px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer">
                  <User className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-bold text-slate-700 max-w-[120px] truncate">{fullName}</span>
                </Link>
                <button
                  onClick={() => {
                    useCartStore.getState().clearCart();
                    logout();
                  }}
                  className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-colors group"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5 text-rose-500 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            ) : (
              <Button onClick={onOpenAuthModal} className="hidden sm:flex">
                Login / Register
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden pb-4">
          <SearchBar placeholder="Search medicines... (Press Enter)" onKeyDown={handleSearch} />
        </div>
      </div>
    </header>
  );
};
