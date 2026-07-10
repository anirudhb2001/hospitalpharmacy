import { api } from '../api';
import { useAuthStore } from './useAuthStore';
import { useCartStore } from './useCartStore';

export const syncCartWithServer = async () => {
  const { isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated) return;

  try {
    const { items } = useCartStore.getState();
    const formattedItems = items.map(i => ({
      item_code: i.medicine.item_code || i.medicine.item,
      qty: i.quantity
    }));

    const res = await api.post('/api/method/hospital_pharmacy.api.sync_cart', { items: formattedItems.length > 0 ? formattedItems : [] });
    
    if (res.data?.message?.status === 'success') {
      const serverItems = res.data.message.cart_items;
      
      // Update local cart with server data (in case there were merges)
      if (serverItems && serverItems.length > 0) {
        useCartStore.setState({
          items: serverItems.map(si => ({
            medicine: si.medicine,
            quantity: si.quantity
          })),
          quotationName: res.data.message.quotation
        });
      } else if (formattedItems.length === 0) {
         useCartStore.setState({ quotationName: res.data.message.quotation });
      }
    }
  } catch (error) {
    console.error("Failed to sync cart:", error);
  }
};

export const fetchCartFromServer = async () => {
  const { isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated) return;

  try {
    const res = await api.post('/api/method/hospital_pharmacy.api.sync_cart');
    
    if (res.data?.message?.status === 'success') {
      const serverItems = res.data.message.cart_items;
      
      if (serverItems && serverItems.length > 0) {
        useCartStore.setState({
          items: serverItems.map(si => ({
            medicine: si.medicine,
            quantity: si.quantity
          })),
          quotationName: res.data.message.quotation
        });
      } else {
        useCartStore.setState({ items: [], quotationName: res.data.message.quotation });
      }
    }
  } catch (error) {
    console.error("Failed to fetch cart:", error);
  }
};
