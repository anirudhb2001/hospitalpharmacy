import React from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, Link, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Bell, User, LogOut, LayoutDashboard, ExternalLink } from 'lucide-react';
import { useAuthStore } from './stores/useAuthStore';
import LoginPage from './pages/portal/LoginPage';
import HomePage from './pages/portal/HomePage';
import AuthModal from './components/AuthModal';
import CartPage from './pages/portal/CartPage';
import CheckoutPage from './pages/portal/CheckoutPage';
import MyOrdersPage from './pages/portal/MyOrdersPage';
import ProfilePage from './pages/portal/ProfilePage';
import AdminNotifications from './pages/admin/AdminNotifications';
import { useCartStore } from './stores/useCartStore';
import { fetchCartFromServer } from './stores/syncCart';
import { adminService } from './services';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';

// ─── Auth Guards ──────────────────────────────────────────────
const AdminRoute = ({ children }) => {
  const { isAuthenticated, isAdmin } = useAuthStore();
  if (!isAuthenticated || !isAdmin) return <Navigate to="/admin/login" replace />;
  return children;
};

// ─── Portal Layout (customer-facing) ─────────────────────────
const PortalLayout = () => {
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const { isAuthenticated } = useAuthStore();

  React.useEffect(() => {
    if (isAuthenticated) {
      fetchCartFromServer();
    }
    
    const handleOpenAuth = () => setShowAuthModal(true);
    window.addEventListener('open-auth-modal', handleOpenAuth);
    return () => window.removeEventListener('open-auth-modal', handleOpenAuth);
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-blue-200">
      <Navbar onOpenAuthModal={() => setShowAuthModal(true)} />
      
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 md:px-6 py-6">
        <Outlet />
      </main>

      <Footer />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

// ─── Admin Layout ─────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
];

const AdminLayout = () => {
  const { fullName, logout } = useAuthStore();
  
  const { data: notifications = [] } = useQuery({
    queryKey: ['adminNotifications'],
    queryFn: adminService.getNotifications,
    refetchInterval: 60000, // 60s
  });
  
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen flex bg-[#f0f2f5]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 hidden md:flex flex-col m-4 mr-0 bg-white rounded-2xl shadow-[6px_6px_12px_#d1d9e6,-4px_-4px_10px_#ffffff] border border-white/60 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow"><span className="text-white text-xs font-bold">Rx</span></div>
            <span className="font-bold text-gray-800">Admin Portal</span>
          </div>
          {fullName && <p className="text-xs text-gray-400 mt-1 truncate">{fullName}</p>}
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto text-sm">
          {[
            ['Dashboard', '/admin', '📊', false],
            ['Medicines', '/app/medicine', '💊', true],
            ['Inventory', '/app/stock-ledger-entry', '📦', true],
            ['Sales', '/app/sales-order', '🧾', true],
            ['Purchases', '/app/purchase-order', '🛒', true],
            ['Payments', '/app/payment-entry', '💳', true],
            ['Customers', '/app/customer', '👥', true],
            ['Suppliers', '/app/supplier', '🏭', true],
            ['Analytics', '/app/dashboard', '📈', true],
            ['Reports', '/app/List/Report', '📋', true],
            ['Notifications', '/admin/notifications', '🔔', false],
            ['Users', '/app/user', '👤', true],
            ['Settings', '/app/system-settings', '⚙️', true],
          ].map(([label, to, emoji, isExternal]) => (
            isExternal ? (
              <a key={label} href={to} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-blue-50 hover:text-blue-700 font-medium transition-all">
                <span>{emoji}</span> {label}
              </a>
            ) : (
              <Link key={to} to={to} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-blue-50 hover:text-blue-700 font-medium transition-all">
                <span>{emoji}</span> {label}
              </Link>
            )
          ))}
          <div className="pt-3 mt-3 border-t border-gray-100">
            <a href="/app" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 font-semibold transition-all">
              <ExternalLink className="w-4 h-4" /> Open ERP Desk
            </a>
          </div>
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 font-medium transition-all text-sm">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col p-4 min-w-0">
        <header className="bg-white rounded-2xl shadow-[6px_6px_12px_#d1d9e6,-4px_-4px_10px_#ffffff] border border-white/60 mb-4 px-5 py-3 flex justify-between items-center">
          <h2 className="text-base font-bold text-gray-800">Administration</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input type="text" placeholder="Search (Ctrl+K)" className="w-48 md:w-64 pl-9 pr-4 py-2 rounded-xl bg-gray-50 shadow-[inset_2px_2px_5px_#d1d9e6] text-sm outline-none focus:ring-2 focus:ring-blue-400" />
              <svg className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <Link to="/admin/notifications" className="relative w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-blue-50 transition">
              <Bell className="w-4 h-4 text-gray-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow text-white text-sm font-bold">
              {fullName?.[0] || 'A'}
            </div>
          </div>
        </header>
        <main className="flex-1 bg-white rounded-2xl shadow-[6px_6px_12px_#d1d9e6,-4px_-4px_10px_#ffffff] border border-white/60 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

// ─── Placeholder Admin Dashboard ──────────────────────────────
const AdminDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const res = await fetch('/api/method/hospital_pharmacy.api.get_dashboard_data');
      const data = await res.json();
      return data.message;
    }
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Dashboard Overview</h2>
      
      {isLoading ? (
        <div className="text-gray-500">Loading live stats...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          {[
            ["Today's Revenue", `₹${stats?.sales_today?.toFixed(2) || '0.00'}`, "blue"],
            ["Pending Orders", stats?.pending_orders || 0, "amber"],
            ["Completed Invoices", stats?.total_invoices || 0, "emerald"],
            ["Low Stock Items", stats?.low_stock || 0, "red"],
            ["Near Expiry", stats?.near_expiry || 0, "orange"],
            ["Total Customers", stats?.total_customers || 0, "violet"],
          ].map(([label, val, color]) => (
            <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-2xl p-5 shadow-[inset_3px_3px_6px_#d1d9e6]`}>
              <p className={`text-xs font-semibold text-${color}-500 uppercase tracking-wide`}>{label}</p>
              <p className={`text-2xl font-bold text-${color}-700 mt-1`}>{val}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-gray-400 text-sm">Showing live data synced with ERPNext fulfillment records.</p>
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/frontend'}>
      <Toaster position="bottom-center" />
      <Routes>
        {/* Customer Portal */}
        <Route path="/" element={<PortalLayout />}>
          <Route index element={<HomePage />} />
          <Route path="medicines" element={<HomePage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="orders" element={<MyOrdersPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>

        {/* Standalone login */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<LoginPage />} />

        {/* Admin Portal */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="*" element={<div className="text-gray-400 text-center py-16">Module coming soon…</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
