// ============================================================
//  CartContext — multi-program shopping cart
//  Stores cart items in localStorage so they survive page refresh.
//
//  IMPORTANT: the cart is namespaced PER ACCOUNT (by parent id, or a
//  shared "guest" bucket while signed out). Previously everything used
//  one single "cca_cart" key regardless of who was logged in, which
//  meant:
//    - Logging out still showed the previous account's cart to anyone
//      using the same browser (a privacy leak on shared computers).
//    - Removing an item while signed out silently deleted it from the
//      account's cart too, because it was really the same storage.
//  Namespacing by account id fixes both: each parent gets their own
//  persisted bucket, and the signed-out "guest" bucket is separate.
// ============================================================
import { createContext, useContext, useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

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

// One bucket per signed-in parent, plus a shared bucket for signed-out
// visitors. "cca_cart_guest" replaces the old single "cca_cart" key.
function storageKeyFor(parentId: string | null | undefined): string {
  return parentId ? `cca_cart_${parentId}` : "cca_cart_guest";
}

function loadCart(key: string): CartItem[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const storageKey = storageKeyFor(user?.id);

  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCouponState] = useState<AppliedCartCoupon | null>(null);
  const [couponDiscount, setCouponDiscountState] = useState(0);

  // Always know which bucket the CURRENT render's mutators should write
  // to (kept in a ref so addItem/removeItem/etc. below never race with
  // the "switch buckets on login/logout" effect further down).
  const activeKeyRef = useRef(storageKey);
  activeKeyRef.current = storageKey;

  // (Re)load the correct bucket once we know who's signed in, and again
  // any time the signed-in account changes (login, logout, or switching
  // accounts on the same browser). Waiting for authLoading to settle
  // avoids briefly flashing the wrong account's cart on page load.
  useEffect(() => {
    if (authLoading) return;
    setItems(loadCart(storageKey));
    setCouponState(null);
    setCouponDiscountState(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, storageKey]);

  const persist = (key: string, next: CartItem[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Non-fatal — worst case the cart doesn't survive a refresh.
    }
  };

  const addItem = (item: Omit<CartItem, "cartId">) => {
    const cartId = `${item.programId}-${item.batchId}-${Date.now()}`;
    setItems((prev) => {
      const next = [...prev, { ...item, cartId }];
      persist(activeKeyRef.current, next);
      return next;
    });
  };

  const removeItem = (cartId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.cartId !== cartId);
      persist(activeKeyRef.current, next);
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
    localStorage.removeItem(activeKeyRef.current);
  };

  const updateStudents = (cartId: string, students: CartStudent[]) => {
    setItems((prev) => {
      const next = prev.map((i) => (i.cartId === cartId ? { ...i, students } : i));
      persist(activeKeyRef.current, next);
      return next;
    });
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
