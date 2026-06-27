// ============================================================
//  CartContext — multi-program shopping cart
//  Stores cart items in localStorage so they survive page refresh.
// ============================================================
import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

export interface CartStudent {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  schoolName: string;
  medicalNotes: string;
}

export interface CartItem {
  cartId: string;           // unique id for this cart entry
  programId: string;
  programTitle: string;
  programImage?: string;
  batchId: string;
  batchName: string;
  selectedMonth: string;    // month label e.g. "July 2025"
  selectedDays: string;     // e.g. "Monday + Wednesday"
  sessionsPerWeek: number;
  fee: number;              // total fee for this item
  students: CartStudent[];
}

export interface AppliedCartCoupon {
  code: string;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  description: string;
  discount: number;
}

interface CartContextValue {
  items: CartItem[];
  coupon: AppliedCartCoupon | null;
  couponDiscount: number;
  addItem: (item: Omit<CartItem, "cartId">) => void;
  removeItem: (cartId: string) => void;
  clearCart: () => void;
  updateStudents: (cartId: string, students: CartStudent[]) => void;
  setCoupon: (coupon: AppliedCartCoupon | null) => void;
  setCouponDiscount: (d: number) => void;
  itemCount: number;
  subtotal: number;
  grandTotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "cca_cart";

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [coupon, setCouponState] = useState<AppliedCartCoupon | null>(null);
  const [couponDiscount, setCouponDiscountState] = useState(0);

  // Persist cart to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (item: Omit<CartItem, "cartId">) => {
    const cartId = `${item.programId}-${item.batchId}-${Date.now()}`;
    setItems((prev) => [...prev, { ...item, cartId }]);
  };

  const removeItem = (cartId: string) => {
  setItems((prev) => {
    const next = prev.filter((i) => i.cartId !== cartId);
    if (next.length === 0) {
      setCouponState(null);
      setCouponDiscountState(0);
    }
    return next;
  });
};

  const clearCart = () => {
    setItems([]);
    setCouponState(null);
    setCouponDiscountState(0);
    localStorage.removeItem(STORAGE_KEY);
  };

  const updateStudents = (cartId: string, students: CartStudent[]) => {
    setItems((prev) =>
      prev.map((i) => (i.cartId === cartId ? { ...i, students } : i))
    );
  };

  const setCoupon = (c: AppliedCartCoupon | null) => {
    setCouponState(c);
    if (!c) setCouponDiscountState(0);
  };

  const setCouponDiscount = (d: number) => setCouponDiscountState(d);

  const subtotal = items.reduce((sum, i) => sum + i.fee * i.students.length, 0);
  const grandTotal = Math.max(0, subtotal - couponDiscount);
  const itemCount = items.reduce((n, i) => n + i.students.length, 0);

  return (
    <CartContext.Provider
      value={{
        items, coupon, couponDiscount,
        addItem, removeItem, clearCart, updateStudents,
        setCoupon, setCouponDiscount,
        itemCount, subtotal, grandTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}