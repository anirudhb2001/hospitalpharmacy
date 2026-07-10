import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ShieldCheck, MapPin, Phone, FileText, CreditCard, Plus, X } from 'lucide-react';
import { useCartStore } from '../../stores/useCartStore';
import { Card, Button, Input } from '../../components/ui';
import { callMethod } from '../../api';
import { toast } from 'react-hot-toast';

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

export default function CheckoutPage() {
  const { items, getCartTotal, clearCart } = useCartStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [phone, setPhone] = useState('');
  const [isFetchingDefaults, setIsFetchingDefaults] = useState(true);

  // Modals
  const [showAddressList, setShowAddressList] = useState(false);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchDefaults();
  }, []);

  const fetchDefaults = async () => {
    try {
      const res = await callMethod('hospital_pharmacy.api.get_customer_addresses');
      if (res?.status === 'success') {
        if (res.mobile_no) setPhone(res.mobile_no);
        setAddresses(res.addresses || []);
        if (res.addresses?.length > 0) {
          const defaultAddr = res.addresses.find(a => a.is_primary_address) || res.addresses[0];
          setSelectedAddressId(defaultAddr.name);
        }
      }
    } catch (err) {
      console.error("Failed to fetch defaults:", err);
    } finally {
      setIsFetchingDefaults(false);
    }
  };

  if (items.length === 0 && !successData) {
    navigate('/cart');
    return null;
  }

  const subtotal = getCartTotal();

  const handlePlaceOrder = async () => {
    setError('');
    
    if (addresses.length === 0) {
      setError('Please add a delivery address.');
      return;
    }
    if (!selectedAddressId) {
      setError('Please select a delivery address.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);

    const cartItems = items.map(i => ({
      item_code: i.medicine.item,
      qty: i.quantity,
      rate: i.medicine.selling_price
    }));

    const payload = {
      items: cartItems,
      quotation_id: useCartStore.getState().quotationName,
      address_id: selectedAddressId,
      phone: phone,
      notes: notes,
      payment_method: paymentMethod
    };

    if (paymentMethod === 'Online Payment') {
      setPendingOrderData(payload);
      setShowPaymentModal(true);
      setLoading(false);
    } else {
      await executeOrder(payload);
    }
  };

  const executeOrder = async (payload) => {
    setLoading(true);
    try {
      const response = await callMethod('hospital_pharmacy.api.place_order', payload);
      
      if (response.status === 'error') {
        setError(response.message || 'Failed to place order.');
        setLoading(false);
        return;
      }
      
      setSuccessData({
        orderId: response.order_id || 'ORD-UNKNOWN',
        delivery: response.estimated_delivery || 'Tomorrow',
        payment: payload.payment_method
      });
      clearCart();
    } catch (err) {
      setError('An operational error occurred while processing your order. Please try again or contact support.');
    }
    setLoading(false);
  };

  const selectedAddress = addresses.find(a => a.name === selectedAddressId);

  return (
    <div className="relative">
      <AnimatePresence>
        {successData && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-0 z-50 bg-white/80 backdrop-blur-3xl rounded-3xl p-10 flex flex-col items-center justify-center text-center shadow-2xl border border-white"
          >
            <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500 mb-8 shadow-[inset_0_4px_10px_rgba(0,0,0,0.1)]">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Order Confirmed!</h2>
            <p className="text-lg text-slate-500 font-medium max-w-md mx-auto mb-10">
              Thank you for choosing Hospital Pharmacy. Your order <span className="font-bold text-blue-600">{successData.orderId}</span> has been successfully placed.
            </p>
            
            <Card className="p-8 w-full max-w-md bg-slate-50 border border-slate-100 mb-10">
              <div className="space-y-4 text-left">
                <div className="flex justify-between border-b border-slate-200 pb-4">
                  <span className="text-slate-500 font-semibold">Estimated Delivery</span>
                  <span className="font-bold text-slate-900">{successData.delivery}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-4">
                  <span className="text-slate-500 font-semibold">Payment Status</span>
                  <span className="font-bold text-emerald-600">{successData.payment === 'Online Payment' ? 'Paid Online' : 'Cash on Delivery'}</span>
                </div>
              </div>
            </Card>

            <div className="flex gap-4">
              <Button variant="secondary" size="lg" onClick={() => navigate('/orders')}>
                View My Orders
              </Button>
              <Button variant="primary" size="lg" onClick={() => navigate('/')}>
                Continue Shopping
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-10">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Checkout</h1>
        <p className="text-slate-500 font-medium mt-2">Complete your order securely</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-3 space-y-8">
          {error && (
            <div className="p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-700 font-semibold rounded-r-xl">
              {error}
            </div>
          )}

          {/* Delivery Details */}
          <Card className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><MapPin className="w-5 h-5" /></div>
              <h2 className="text-2xl font-bold text-slate-900">Delivery Details</h2>
            </div>
            
            <div className="space-y-5">
              <Input 
                label="Primary Phone Number" 
                placeholder="10-digit mobile number" 
                required 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Delivery Address</label>
                
                {isFetchingDefaults ? (
                  <div className="animate-pulse h-24 bg-slate-100 rounded-xl"></div>
                ) : addresses.length === 0 ? (
                  <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center bg-slate-50">
                    <p className="text-slate-500 font-medium mb-4">No saved addresses found.</p>
                    <Button onClick={() => setShowNewAddressForm(true)}>Add New Address</Button>
                  </div>
                ) : selectedAddress ? (
                  <div className="p-5 border-2 border-blue-500 rounded-2xl bg-blue-50/30 flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">{selectedAddress.address_title}</h4>
                      <p className="text-sm text-slate-600">{selectedAddress.address_line1}</p>
                      {selectedAddress.address_line2 && <p className="text-sm text-slate-600">{selectedAddress.address_line2}</p>}
                      <p className="text-sm text-slate-600">{selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode}</p>
                      {selectedAddress.phone && <p className="text-sm text-slate-600 mt-1 flex items-center gap-1"><Phone className="w-3.5 h-3.5"/> {selectedAddress.phone}</p>}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setShowAddressList(true)}>Change</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="secondary" onClick={() => setShowAddressList(true)}>Select Address</Button>
                )}
              </div>

              <Input 
                label="Delivery Notes (Optional)" 
                placeholder="e.g. Please leave at the security gate" 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </Card>

          <Card className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600"><CreditCard className="w-5 h-5" /></div>
              <h2 className="text-2xl font-bold text-slate-900">Payment Method</h2>
            </div>
            <div className="space-y-4">
              <label className="flex items-center p-4 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors">
                <input type="radio" checked={paymentMethod === 'Cash on Delivery'} onChange={() => setPaymentMethod('Cash on Delivery')} className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500" />
                <div className="ml-4 flex-1">
                  <span className="block font-bold text-slate-900">Cash on Delivery</span>
                  <span className="block text-sm font-medium text-slate-500 mt-0.5">Pay when your order arrives</span>
                </div>
              </label>
              <label className="flex items-center p-4 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors">
                <input type="radio" checked={paymentMethod === 'Online Payment'} onChange={() => setPaymentMethod('Online Payment')} className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500" />
                <div className="ml-4 flex-1">
                  <span className="block font-bold text-slate-900">Online Payment</span>
                  <span className="block text-sm font-medium text-slate-500 mt-0.5">Pay securely via Credit/Debit Card, UPI, or Netbanking</span>
                </div>
              </label>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="p-8 sticky top-32 bg-slate-50/50 backdrop-blur-xl border border-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600"><FileText className="w-5 h-5" /></div>
              <h2 className="text-2xl font-bold text-slate-900">Order Summary</h2>
            </div>
            
            <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2">
              {items.map(({ medicine, quantity }) => (
                <div key={medicine.name} className="flex justify-between items-center text-sm font-medium">
                  <div className="flex-1 pr-4">
                    <p className="text-slate-900 font-bold line-clamp-1">{medicine.medicine_name}</p>
                    <p className="text-slate-500">Qty: {quantity}</p>
                  </div>
                  <span className="font-bold text-slate-900">₹{(parseFloat(medicine.selling_price) * quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-4 text-slate-600 font-medium mb-8 pt-6 border-t border-slate-200">
              <div className="flex justify-between items-center">
                <span>Subtotal</span>
                <span className="font-bold text-slate-900">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Shipping</span>
                <span className="font-bold text-emerald-500">Free</span>
              </div>
            </div>
            
            <div className="pt-6 border-t-2 border-slate-200 border-dashed mb-8">
              <div className="flex justify-between items-end">
                <span className="text-xl font-bold text-slate-900">Total Payable</span>
                <span className="text-4xl font-black text-blue-600 tracking-tight">₹{subtotal.toFixed(2)}</span>
              </div>
            </div>

            <Button onClick={handlePlaceOrder} size="lg" className="w-full h-14 text-lg shadow-[0_8px_20px_rgba(37,99,235,0.3)]" isLoading={loading}>
              Place Order
            </Button>
            
            <div className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Secure SSL Checkout
            </div>
          </Card>
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <Card className="relative p-8 w-full max-w-md text-center">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Simulated Payment Gateway</h2>
            <p className="text-slate-500 font-medium mb-8">This is a mock payment screen for demonstration purposes.</p>
            <div className="bg-slate-50 p-6 rounded-2xl mb-8 border border-slate-100">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Amount to Pay</p>
              <p className="text-4xl font-black text-blue-600">₹{subtotal.toFixed(2)}</p>
            </div>
            <div className="flex gap-4">
              <Button variant="secondary" className="flex-1" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
              <Button variant="primary" className="flex-1" onClick={() => executeOrder(pendingOrderData)} isLoading={loading}>Pay Now</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Address Selection Modal */}
      {showAddressList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <Card className="w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-slate-900">Select Delivery Address</h2>
              <button onClick={() => setShowAddressList(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {addresses.map((addr) => (
                <div 
                  key={addr.name} 
                  onClick={() => {
                    setSelectedAddressId(addr.name);
                    setShowAddressList(false);
                  }}
                  className={`p-4 border-2 rounded-2xl cursor-pointer transition-all ${selectedAddressId === addr.name ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 hover:border-blue-300'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900">{addr.address_title}</h4>
                      <p className="text-sm text-slate-600 mt-1">{addr.address_line1}</p>
                      {addr.address_line2 && <p className="text-sm text-slate-600">{addr.address_line2}</p>}
                      <p className="text-sm text-slate-600">{addr.city}, {addr.state} - {addr.pincode}</p>
                    </div>
                    {selectedAddressId === addr.name && <CheckCircle2 className="w-6 h-6 text-blue-500" />}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
              <Button className="w-full flex items-center justify-center gap-2" variant="secondary" onClick={() => {
                setShowAddressList(false);
                setShowNewAddressForm(true);
              }}>
                <Plus className="w-4 h-4" /> Add New Address
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* New Address Form Modal */}
      {showNewAddressForm && (
        <AddressModal 
          onClose={() => setShowNewAddressForm(false)}
          onSuccess={async (newId) => {
            setShowNewAddressForm(false);
            await fetchDefaults();
            if (newId) setSelectedAddressId(newId);
          }}
        />
      )}
    </div>
  );
}

// Inline AddressModal for Checkout (Shares logic with Profile)
function AddressModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    
    if (!/^[6-9]\d{9}$/.test(data.phone)) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    if (!/^\d{6,7}$/.test(data.pincode)) {
      toast.error("Please enter a valid 6 or 7 digit pincode");
      return;
    }
    if (data.address_line1.trim().length < 5) {
      toast.error("Address line must be at least 5 characters long");
      return;
    }
    if (data.city.trim().length < 3) {
      toast.error("Please enter a valid city name");
      return;
    }

    setLoading(true);
    try {
      data.is_primary_address = data.is_primary_address === 'on' ? 1 : 0;
      const res = await callMethod('hospital_pharmacy.api.create_address', data);

      if (res?.status === 'success') {
        toast.success(`Address saved successfully!`);
        onSuccess(res.address_id);
      } else {
        toast.error(res?.message || 'Failed to save address');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-slate-900">Add New Address</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form id="newAddressForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="col-span-1 md:col-span-2">
              <Input name="address_title" label="Address Label (Optional)" placeholder="e.g. Home, Office, John's House" />
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <Input name="address_line1" label="House/Building Name, Street" required />
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <Input name="address_line2" label="Area, Landmark (Optional)" />
            </div>
            
            <Input name="city" label="City / Town" required />
            
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">State</label>
              <select 
                name="state" 
                defaultValue={INDIAN_STATES[0]} 
                required 
                className="w-full px-4 py-2.5 rounded-xl text-base outline-none transition-all duration-300 bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                {INDIAN_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>

            <Input name="pincode" label="Pincode" required />
            <Input name="country" label="Country" defaultValue="India" required />
            
            <div className="col-span-1 md:col-span-2">
              <Input name="phone" label="Delivery Phone Number" required placeholder="10-digit mobile" />
            </div>

            <div className="col-span-1 md:col-span-2 flex items-center gap-3 pt-2">
              <input 
                type="checkbox" 
                name="is_primary_address" 
                id="is_primary_chk"
                defaultChecked={true} 
                className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <label htmlFor="is_primary_chk" className="font-medium text-slate-700">Set as Default Shipping Address</label>
            </div>
          </form>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" form="newAddressForm" loading={loading}>Save Address</Button>
        </div>
      </Card>
    </div>
  );
}
