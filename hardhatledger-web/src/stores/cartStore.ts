import { create } from 'zustand';
import type { CartItem, Client, Product } from '../types';

interface CartState {
  items: CartItem[];
  client: Client | null;
  fulfillmentType: 'delivery' | 'pickup';
  addItem: (product: Product, quantity: number, unitPrice: number) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  updateDiscount: (productId: number, discount: number) => void;
  setClient: (client: Client | null) => void;
  setFulfillmentType: (type: 'delivery' | 'pickup') => void;
  getSubtotal: () => number;
  getDiscountTotal: () => number;
  getTotal: () => number;
  clear: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  client: null,
  fulfillmentType: 'pickup',

  addItem: (product, quantity, unitPrice) => {
    const items = [...get().items];
    const existing = items.find((i) => i.product.id === product.id);

    if (existing) {
      existing.quantity += quantity;
      existing.line_total = existing.quantity * existing.unit_price - existing.discount;
    } else {
      items.push({
        product,
        quantity,
        unit_price: unitPrice,
        discount: 0,
        line_total: quantity * unitPrice,
      });
    }

    set({ items });
  },

  removeItem: (productId) => {
    set({ items: get().items.filter((i) => i.product.id !== productId) });
  },

  updateQuantity: (productId, quantity) => {
    const items = get().items.map((item) =>
      item.product.id === productId
        ? { ...item, quantity, line_total: quantity * item.unit_price - item.discount }
        : item
    );
    set({ items });
  },

  updateDiscount: (productId, discount) => {
    const items = get().items.map((item) =>
      item.product.id === productId
        ? { ...item, discount, line_total: item.quantity * item.unit_price - discount }
        : item
    );
    set({ items });
  },

  setClient: (client) => set({ client }),
  setFulfillmentType: (type) => set({ fulfillmentType: type }),

  getSubtotal: () => get().items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0),
  getDiscountTotal: () => get().items.reduce((sum, i) => sum + i.discount, 0),
  getTotal: () => get().items.reduce((sum, i) => sum + i.line_total, 0),

  clear: () => set({ items: [], client: null, fulfillmentType: 'pickup' }),
}));
