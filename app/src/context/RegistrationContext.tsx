import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { Program } from "../types/program";
import type { BatchItem } from "../components/registration/BatchList";
import { useAuth } from "./AuthContext";
import { getMyStudents, getParentProfile } from "../services/parentDashboardService";

export type PaymentMethod = "PayPal" | "Stripe" | "Check" | "";
export type CheckoutMode = "guest" | "account" | "";

export interface StudentDetails {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  schoolName: string;
  medicalNotes: string;
  selectedBatch: BatchItem | null;
}

export interface ParentDetails {
  parentName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

// Coupon info returned from the backend /validate-coupon endpoint
export interface AppliedCoupon {
  code: string;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  description: string;
  discount: number;   // dollar amount saved
  usedCount: number;
  maxUses: number | null;
}

export interface RegistrationContextValue {
  // Program selection
  selectedProgram: Program | null;
  selectedBatch: BatchItem | null;

  // Multi-student support
  students: StudentDetails[];
  currentStudentIndex: number;

  // Parent / billing
  parentDetails: ParentDetails;

  // Payment
  subtotal: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;

  // Account vs Guest
  checkoutMode: CheckoutMode;

  // Coupon
  appliedCoupon: AppliedCoupon | null;
  couponDiscount: number;

  // Setters
  setSelectedProgram: (program: Program | null) => void;
  setSelectedBatch: (batch: BatchItem | null) => void;
  addStudent: (student: StudentDetails) => void;
  updateStudent: (index: number, student: Partial<StudentDetails>) => void;
  removeStudent: (index: number) => void;
  setCurrentStudentIndex: (index: number) => void;
  updateParent: (parent: Partial<ParentDetails>) => void;
  setSubtotal: (amount: number) => void;
  setTotalAmount: (amount: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setCheckoutMode: (mode: CheckoutMode) => void;
  setAppliedCoupon: (coupon: AppliedCoupon | null) => void;
  setCouponDiscount: (discount: number) => void;
  resetRegistration: () => void;
}

const emptyStudent = (): StudentDetails => ({
  firstName: "",
  lastName: "",
  dob: "",
  gender: "",
  schoolName: "",
  medicalNotes: "",
  selectedBatch: null,
});

const initialParentDetails: ParentDetails = {
  parentName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip: "",
};

const RegistrationContext = createContext<RegistrationContextValue | null>(null);

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [students, setStudents] = useState<StudentDetails[]>([emptyStudent()]);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [parentDetails, setParentDetails] = useState<ParentDetails>(initialParentDetails);
  const [subtotal, setSubtotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("");
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);

  const { token } = useAuth();

  // ── Autofill from saved profile ──────────────────────────────
  // When a parent is logged in, pre-fill the first student's details from
  // their most recently saved child (if any) and the billing address from
  // their saved profile — so returning parents don't retype everything.
  // Only fills fields that are still blank, and only touches the very
  // first, still-empty student slot, so it never clobbers what someone is
  // actively typing (including mid-flow via Quick Register / chatbot).
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const [myStudents, profile] = await Promise.all([
          getMyStudents(token).catch(() => []),
          getParentProfile(token).catch(() => null),
        ]);

        if (myStudents && myStudents.length > 0) {
          const mostRecent = [...myStudents].sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          )[0];
          setStudents((prev) => {
            if (prev.length !== 1) return prev; // don't touch an in-progress multi-student cart
            const s = prev[0];
            if (s.firstName.trim() || s.lastName.trim()) return prev; // already filled in — leave it
            return [{
              ...s,
              firstName: mostRecent.firstName || "",
              lastName: mostRecent.lastName || "",
              dob: mostRecent.dob ? String(mostRecent.dob).slice(0, 10) : "",
              gender: mostRecent.gender || "",
              schoolName: mostRecent.schoolName || "",
              medicalNotes: mostRecent.medicalNotes || "",
            }];
          });
        }

        if (profile) {
          setParentDetails((prev) => {
            if (prev.parentName.trim() || prev.address.trim()) return prev; // already filled in
            return {
              parentName: `${profile.firstName} ${profile.lastName}`.trim(),
              email: profile.email || "",
              phone: profile.phone || "",
              address: profile.address || "",
              city: profile.city || "",
              state: profile.state || "",
              zip: profile.zip || "",
            };
          });
        }
      } catch {
        // Non-fatal — the person can just fill the form in manually.
      }
    })();
  }, [token]);

  const addStudent = (student: StudentDetails) => {
    setStudents((prev) => [...prev, student]);
  };

  const updateStudent = (index: number, student: Partial<StudentDetails>) => {
    setStudents((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...student } : s))
    );
  };

  const removeStudent = (index: number) => {
    setStudents((prev) => prev.filter((_, i) => i !== index));
  };

  const updateParent = (parent: Partial<ParentDetails>) => {
    setParentDetails((prev) => ({ ...prev, ...parent }));
  };

  const resetRegistration = () => {
    setSelectedProgram(null);
    setSelectedBatch(null);
    setStudents([emptyStudent()]);
    setCurrentStudentIndex(0);
    setParentDetails(initialParentDetails);
    setSubtotal(0);
    setTotalAmount(0);
    setPaymentMethod("");
    setCheckoutMode("");
    setAppliedCoupon(null);
    setCouponDiscount(0);
  };

  return (
    <RegistrationContext.Provider
      value={{
        selectedProgram,
        selectedBatch,
        students,
        currentStudentIndex,
        parentDetails,
        subtotal,
        totalAmount,
        paymentMethod,
        checkoutMode,
        appliedCoupon,
        couponDiscount,
        setSelectedProgram,
        setSelectedBatch,
        addStudent,
        updateStudent,
        removeStudent,
        setCurrentStudentIndex,
        updateParent,
        setSubtotal,
        setTotalAmount,
        setPaymentMethod,
        setCheckoutMode,
        setAppliedCoupon,
        setCouponDiscount,
        resetRegistration,
      }}
    >
      {children}
    </RegistrationContext.Provider>
  );
}

export function useRegistration() {
  const context = useContext(RegistrationContext);
  if (!context) {
    throw new Error("useRegistration must be used within a RegistrationProvider");
  }
  return context;
}
