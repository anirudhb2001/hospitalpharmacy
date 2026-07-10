import { create } from 'zustand';
import { syncCartWithServer } from './syncCart';

export const useCartStore = create((set, get) => ({
  items: [], // { medicine, quantity }
  
  addItem: (medicine, quantity = 1) => {
    set((state) => {
      const existing = state.items.find((i) => i.medicine.name === medicine.name);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.medicine.name === medicine.name
              ? { ...i, quantity: i.quantity + quantity }
              : i
          ),
        };
      }
      return { items: [...state.items, { medicine, quantity }] };
    });
    syncCartWithServer();
  },
  
  removeItem: (medicineName) => {
    set((state) => ({
      items: state.items.filter((i) => i.medicine.name !== medicineName),
    }));
    syncCartWithServer();
  },
  
  updateQuantity: (medicineName, quantity) => {
    set((state) => {
      if (quantity <= 0) {
        return { items: state.items.filter((i) => i.medicine.name !== medicineName) };
      }
      return {
        items: state.items.map((i) =>
          i.medicine.name === medicineName ? { ...i, quantity } : i
        ),
      };
    });
    syncCartWithServer();
  },
  
  clearCart: () => set({ items: [] }),
  
  getCartTotal: () => {
    const { items } = get();
    return items.reduce((total, item) => total + (item.medicine.selling_price * item.quantity), 0);
  },
  
  getItemCount: () => {
    const { items } = get();
    return items.reduce((count, item) => count + item.quantity, 0);
  }
}));
