import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useCartStore } from './useCartStore';
import { api } from '../api';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,         // email string
      fullName: null,     // display name
      isAuthenticated: false,
      isAdmin: false,
      pendingAction: null, // { type: 'buy_now' | 'add_to_cart', payload: medicine }
      
      setPendingAction: (action) => set({ pendingAction: action }),
      clearPendingAction: () => set({ pendingAction: null }),
      
      login: (user, fullName, isAdmin = false) =>
        set({ user, fullName, isAuthenticated: true, isAdmin }),
      
      logout: async () => {
        try {
          await api.post('/api/method/logout');
        } catch (e) {
          console.error('Backend logout failed:', e);
        }
        useCartStore.getState().clearCart();
        set({ user: null, fullName: null, isAuthenticated: false, isAdmin: false, pendingAction: null });
      },
    }),
    { 
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        fullName: state.fullName,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin
      }),
    }
  )
);
