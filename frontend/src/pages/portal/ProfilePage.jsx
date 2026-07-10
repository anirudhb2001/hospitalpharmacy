import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { callMethod } from '../../api';
import { Card, Button, Input } from '../../components/ui';
import { MapPin, Phone, User, Plus, Edit2, Trash2, CheckCircle2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

export default function ProfilePage() {
  const { user, fullName, isAuthenticated } = useAuthStore();
  const [addresses, setAddresses] = useState([]);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);

  // Phone editing state
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editPhoneValue, setEditPhoneValue] = useState('');
  
  // Address modal state
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfileData();
    }
  }, [isAuthenticated]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const res = await callMethod('hospital_pharmacy.api.get_customer_addresses');
      if (res?.status === 'success') {
        setAddresses(res.addresses || []);
        setPhone(res.mobile_no || '');
        setEditPhoneValue(res.mobile_no || '');
      }
    } catch (err) {
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePhone = async () => {
    if (!/^[6-9]\d{9}$/.test(editPhoneValue)) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }
    try {
      const res = await callMethod('hospital_pharmacy.api.update_customer_profile', { phone: editPhoneValue });
      if (res?.status === 'success') {
        setPhone(editPhoneValue);
        setIsEditingPhone(false);
        toast.success('Phone number updated successfully');
      }
    } catch (err) {
      toast.error('Failed to update phone number');
    }
  };

  const handleDeleteAddress = async (id) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    try {
      const res = await callMethod('hospital_pharmacy.api.delete_address', { address_id: id });
      if (res?.status === 'success') {
        toast.success('Address deleted');
        fetchProfileData();
      }
    } catch (err) {
      toast.error('Failed to delete address');
    }
  };

  const handleSetDefaultAddress = async (id) => {
    try {
      const res = await callMethod('hospital_pharmacy.api.set_default_address', { address_id: id });
      if (res?.status === 'success') {
        toast.success('Default address updated');
        fetchProfileData();
      }
    } catch (err) {
      toast.error('Failed to set default address');
    }
  };

  const openAddModal = () => {
    setEditingAddress(null);
    setShowAddressModal(true);
  };

  const openEditModal = (addr) => {
    setEditingAddress(addr);
    setShowAddressModal(true);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">My Profile</h1>
        <p className="text-slate-500 font-medium mt-2">Manage your personal details and saved addresses</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Personal Details */}
        <Card className="p-6 h-fit">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><User className="w-5 h-5" /></div>
            <h2 className="text-xl font-bold text-slate-900">Personal Details</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-slate-500 mb-1">Full Name</p>
              <p className="text-lg font-medium text-slate-800">{fullName}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 mb-1">Email Address</p>
              <p className="text-lg font-medium text-slate-800">{user}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 mb-1">Phone Number</p>
              {isEditingPhone ? (
                <div className="flex items-center gap-2 mt-2">
                  <Input 
                    value={editPhoneValue} 
                    onChange={(e) => setEditPhoneValue(e.target.value)} 
                    placeholder="10-digit mobile" 
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleUpdatePhone}>Save</Button>
                  <Button size="sm" variant="secondary" onClick={() => setIsEditingPhone(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center justify-between mt-1">
                  <p className="text-lg font-medium text-slate-800">{phone || 'Not set'}</p>
                  <button onClick={() => setIsEditingPhone(true)} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Address Book */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600"><MapPin className="w-5 h-5" /></div>
              <h2 className="text-2xl font-bold text-slate-900">My Addresses</h2>
            </div>
            <Button onClick={openAddModal} className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add New Address
            </Button>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-32 bg-slate-200 rounded-2xl"></div>
              <div className="h-32 bg-slate-200 rounded-2xl"></div>
            </div>
          ) : addresses.length === 0 ? (
            <Card className="p-12 text-center flex flex-col items-center justify-center border-dashed border-2 border-slate-200 shadow-none bg-slate-50">
              <MapPin className="w-12 h-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-700 mb-2">No Saved Addresses</h3>
              <p className="text-slate-500 mb-6">Add a delivery address to make checkout faster next time.</p>
              <Button onClick={openAddModal} variant="secondary">Add New Address</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <Card key={addr.name} className={`p-6 border-2 transition-all ${addr.is_primary_address ? 'border-blue-500 shadow-[0_8px_16px_-4px_rgba(59,130,246,0.2)]' : 'border-transparent'}`}>
                  {addr.is_primary_address && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mb-3">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Default Shipping
                    </span>
                  )}
                  <h3 className="font-bold text-slate-900 text-lg mb-1">{addr.address_title}</h3>
                  <div className="text-slate-600 text-sm space-y-0.5 mb-4">
                    <p>{addr.address_line1}</p>
                    {addr.address_line2 && <p>{addr.address_line2}</p>}
                    <p>{addr.city}, {addr.state} {addr.pincode}</p>
                    {addr.phone && <p className="pt-2 text-slate-700 font-medium flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {addr.phone}</p>}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100">
                    <button onClick={() => openEditModal(addr)} className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">Edit</button>
                    <span className="text-slate-300">|</span>
                    <button onClick={() => handleDeleteAddress(addr.name)} className="text-sm font-semibold text-slate-600 hover:text-rose-600 transition-colors">Delete</button>
                    {!addr.is_primary_address && (
                      <>
                        <span className="text-slate-300">|</span>
                        <button onClick={() => handleSetDefaultAddress(addr.name)} className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">Set as Default</button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddressModal && (
        <AddressModal 
          address={editingAddress} 
          onClose={() => setShowAddressModal(false)} 
          onSuccess={() => {
            setShowAddressModal(false);
            fetchProfileData();
          }} 
        />
      )}
    </div>
  );
}

// ─── Address Modal Component ──────────────────────────────────
function AddressModal({ address, onClose, onSuccess }) {
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
      
      let res;
      if (address) {
        res = await callMethod('hospital_pharmacy.api.update_address', { ...data, address_id: address.name });
      } else {
        res = await callMethod('hospital_pharmacy.api.create_address', data);
      }

      if (res?.status === 'success') {
        toast.success(`Address ${address ? 'updated' : 'saved'} successfully!`);
        onSuccess();
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
          <h2 className="text-xl font-bold text-slate-900">{address ? 'Edit Address' : 'Add New Address'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form id="addressForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="col-span-1 md:col-span-2">
              <Input name="address_title" label="Address Label (Optional)" defaultValue={address?.address_title} placeholder="e.g. Home, Office, John's House" />
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <Input name="address_line1" label="House/Building Name, Street" defaultValue={address?.address_line1} required />
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <Input name="address_line2" label="Area, Landmark (Optional)" defaultValue={address?.address_line2} />
            </div>
            
            <Input name="city" label="City / Town" defaultValue={address?.city} required />
            
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">State</label>
              <select 
                name="state" 
                defaultValue={address?.state || INDIAN_STATES[0]} 
                required 
                className="w-full px-4 py-2.5 rounded-xl text-base outline-none transition-all duration-300 bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                {INDIAN_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            
            <Input name="pincode" label="Pincode" defaultValue={address?.pincode} required />
            <Input name="country" label="Country" defaultValue={address?.country || 'India'} required />
            
            <div className="col-span-1 md:col-span-2">
              <Input name="phone" label="Delivery Phone Number" defaultValue={address?.phone} required placeholder="10-digit mobile" />
            </div>

            <div className="col-span-1 md:col-span-2 flex items-center gap-3 pt-2">
              <input 
                type="checkbox" 
                name="is_primary_address" 
                id="is_primary"
                defaultChecked={address ? address.is_primary_address : true} 
                className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <label htmlFor="is_primary" className="font-medium text-slate-700">Set as Default Shipping Address</label>
            </div>
          </form>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" form="addressForm" loading={loading}>{address ? 'Update Address' : 'Save Address'}</Button>
        </div>
      </Card>
    </div>
  );
}
