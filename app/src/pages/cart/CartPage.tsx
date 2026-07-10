// ============================================================
//  CartPage — view cart items, fill parent details, pay — all in one page.
//  Checkout no longer navigates to /review-order or /payment: the parent
//  details form and PayPal/Check payment are embedded right here.
// ============================================================
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { getParentProfile } from "../../services/parentDashboardService";
import api from "../../api/axios";
import WaiverConsent from "../../components/registration/WaiverConsent";
import { WAIVER_AGREEMENT_VERSION } from "../../constants/waiverAgreement";
import StripePaymentBox from "../../components/payments/StripePaymentBox";
import {
  HiOutlineTrash, HiOutlineTag, HiOutlineXCircle,
  HiOutlineArrowRight, HiOutlineShoppingCart, HiOutlineTicket,
} from "react-icons/hi2";
import { HiOutlineArrowLeft } from "react-icons/hi";

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";

// ── Inline login modal (same pattern as ProgramDetails) ──────────────────────
function LoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email, password);
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[24px] bg-white p-7 shadow-2xl"
        style={{ border: "1px solid var(--pitch-deep)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#A33B2B" }}>Sign in to checkout</p>
            <h2 className="text-lg font-bold text-[#0F172A] mt-0.5">One more step</h2>
            <p className="text-xs text-slate-500 mt-1">Your cart is saved — sign in and we'll take you straight to payment.</p>
          </div>
          <button type="button" onClick={onClose} className="ml-3 shrink-0 rounded-full h-7 w-7 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition text-lg">✕</button>
        </div>
        {error && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-600">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Email</label>
            <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@email.com"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-[#A33B2B] transition" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-[#A33B2B] transition" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-full py-3 text-sm font-bold transition disabled:opacity-50 mt-1"
            style={{ background: "#A33B2B", color: "white" }}>
            {loading ? "Signing in..." : "Sign In & Continue"}
          </button>
        </form>
        <div className="mt-4 text-center">
          <span className="text-xs text-slate-500">Don't have an account? </span>
          <button type="button" onClick={() => navigate("/login")} className="text-xs font-semibold hover:underline" style={{ color: "#A33B2B" }}>
            Create one
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Parent / Guardian details shape (kept local to this page) ───────────────
interface ParentForm {
  parentName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

const emptyParentForm: ParentForm = {
  parentName: "", email: "", phone: "", address: "", city: "", state: "", zip: "",
};

type PaymentMethod = "PayPal" | "Stripe" | "Check" | "";

// ── CartPage ──────────────────────────────────────────────────────────────────
export default function CartPage() {
  const navigate = useNavigate();
  const { isLoggedIn, user, token } = useAuth();
  const {
    items, coupon, couponDiscount,
    removeItem, clearCart, setCoupon,
    subtotal, grandTotal, itemCount,
  } = useCart();

  const [couponInput, setCouponInput] = useState(coupon?.code ?? "");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // ── Parent / Guardian details — filled right here on the cart page ──
  const [parentDetails, setParentDetails] = useState<ParentForm>(emptyParentForm);
  const [parentTouched, setParentTouched] = useState(false);

  // ── Payment ──
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [checkPayableTo, setCheckPayableTo] = useState("California Cricket Academy");
  const [checkNumber, setCheckNumber] = useState("");
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [waiverSignature, setWaiverSignature] = useState("");
  const [waiverDrawnSignature, setWaiverDrawnSignature] = useState("");
  const [waiverError, setWaiverError] = useState<string | null>(null);
  const paypalRef = useRef<HTMLDivElement>(null);
  const paypalLoaded = useRef(false);
  const [serverConfirmedAmount, setServerConfirmedAmount] = useState<number | null>(null);

  // BUG FIX: serverConfirmedAmount is a price quote from PayPal/Stripe's
  // create-order call. It used to be left in state forever, so if the
  // person added another program, changed the coupon, or switched payment
  // tabs afterwards, the page kept showing that old quote instead of the
  // freshly-computed grandTotal — e.g. Subtotal correctly becomes $720
  // after adding a 2nd program, but "Grand Total" stayed frozen at an old
  // $860 quote from before that item was added. Clearing it any time the
  // cart, coupon, or selected payment method changes means the displayed
  // total is always either the live client-side grandTotal, or a quote
  // that was actually fetched for the CURRENT cart/coupon/method.
  useEffect(() => {
    setServerConfirmedAmount(null);
  }, [items, coupon, paymentMethod]);

  // Pre-fill parent details from the signed-in account — name/email/phone
  // immediately, then the saved billing address (if any) from their profile,
  // so returning parents don't have to retype it. They can still edit it.
  useEffect(() => {
    if (user && !parentDetails.parentName) {
      setParentDetails((prev) => ({
        ...prev,
        parentName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!token) return;
    getParentProfile(token)
      .then((profile) => {
        setParentDetails((prev) =>
          prev.address.trim()
            ? prev
            : {
                ...prev,
                address: profile.address || "",
                city: profile.city || "",
                state: profile.state || "",
                zip: profile.zip || "",
              }
        );
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    api.get("/public/coupons").then((res) => {
      if (res.data.success) setAvailableCoupons(res.data.data);
    }).catch(() => {});
  }, []);

  const updateParent = (patch: Partial<ParentForm>) =>
    setParentDetails((prev) => ({ ...prev, ...patch }));

  const parentValid = Boolean(
    parentDetails.parentName.trim() &&
    parentDetails.email.trim() &&
    parentDetails.phone.trim() &&
    parentDetails.address.trim() &&
    parentDetails.city.trim() &&
    parentDetails.state.trim() &&
    parentDetails.zip.trim()
  );
  const waiverValid = waiverAccepted && Boolean(waiverSignature.trim()) && Boolean(waiverDrawnSignature);

  // ── Coupon handling ──
  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (items.length === 0) { setCouponError("Add a program to your cart first."); return; }
    setCouponError(null); setCouponLoading(true);
    const firstItem = items[0];
    try {
      const res = await api.post("/public/validate-coupon", {
        couponCode: code,
        programId: firstItem.programId,
        batchId: firstItem.batchId,
        studentCount: itemCount || 1,
        sessionsPerWeek: firstItem.sessionsPerWeek,
      });
      if (res.data.success) {
        setCoupon({
          code: res.data.coupon.code,
          type: res.data.coupon.type,
          value: res.data.coupon.value,
          description: res.data.coupon.description,
          discount: res.data.discount,
        });
        // BUG FIX: setCouponDiscount doesn't exist on the cart context —
        // couponDiscount is derived automatically from (items, coupon) by
        // CartContext via calculateCartTotals, so there's nothing to set
        // here. Calling it used to throw "setCouponDiscount is not a
        // function" the instant a coupon was applied.
        setCouponInput(res.data.coupon.code);
      } else {
        setCouponError(res.data.message || "Invalid coupon.");
      }
    } catch (err: any) {
      setCouponError(err?.response?.data?.message ?? "Could not validate coupon. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    // BUG FIX: same as above — setCouponDiscount doesn't exist; clearing
    // the coupon itself is enough, the derived discount drops to 0 on its own.
    setCoupon(null); setCouponInput(""); setCouponError(null);
  };

  // First cart item anchors the program/batch used for server-side pricing —
  // same simplification the rest of the app already uses for multi-item carts.
  const firstItem = items[0];

  // ── Submit the registration to the backend, then clear the cart ──
  const submitRegistration = async (method: string, transactionId?: string) => {
    if (!waiverValid) {
      setWaiverError("Please accept the waiver, type your e-signature, and draw your digital signature before registering.");
      return;
    }
    setPayError(null);
    setWaiverError(null);
    setPaying(true);
    try {
      const parentInfo = user
        ? { parentName: `${user.firstName} ${user.lastName}`, email: user.email, phone: user.phone, address: parentDetails.address, city: parentDetails.city, state: parentDetails.state, zip: parentDetails.zip }
        : parentDetails;

      // Flatten every cart item's students into one list. Each student keeps
      // a reference to their own batch so mixed-program carts still price
      // and record correctly.
      const allStudents = items.flatMap((item) =>
        item.students.map((s) => ({
          ...s,
          selectedBatch: {
            _id: item.batchId,
            name: item.batchName,
            days: item.selectedDays,
            timing: item.selectedDays,
            fee: item.fee,
            seats: 999,
            sessionsPerWeek: item.sessionsPerWeek,
          },
        }))
      );

      const response = await api.post(
        "/public/register",
        {
          selectedProgram: { _id: firstItem.programId, title: firstItem.programTitle },
          selectedBatch: {
            _id: firstItem.batchId,
            name: firstItem.batchName,
            days: firstItem.selectedDays,
            timing: firstItem.selectedDays,
            fee: firstItem.fee,
            seats: 999,
            sessionsPerWeek: firstItem.sessionsPerWeek,
          },
          students: allStudents,
          parent: parentInfo,
          parentId: user ? user.id : undefined,
          sessionsPerWeek: firstItem.sessionsPerWeek,
          paymentMethod: method,
          transactionId,
          checkNumber: method === "Check" ? checkNumber : undefined,
          checkoutMode: user ? "account" : "guest",
          couponCode: coupon?.code ?? undefined,
          waiverConsent: {
            accepted: waiverAccepted,
            signature: waiverSignature.trim(),
            drawnSignature: waiverDrawnSignature,
            agreementVersion: WAIVER_AGREEMENT_VERSION,
          },
        },
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );
      clearCart();
      navigate("/success", { state: response.data });
    } catch (err: any) {
      setPayError(err?.response?.data?.message || (err instanceof Error ? err.message : "Registration failed. Please try again."));
    } finally {
      setPaying(false);
    }
  };

  const submitCheck = async () => {
    if (!parentValid) { setParentTouched(true); return; }
    if (!waiverValid) {
      setWaiverError("Please accept the waiver, type your e-signature, and draw your digital signature before registering.");
      return;
    }
    if (!checkPayableTo.trim()) { setPayError("Please fill check details."); return; }
    await submitRegistration("Check");
  };

  // Load PayPal SDK
  useEffect(() => {
    if (!PAYPAL_CLIENT_ID || window.paypal) return;
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  // Render PayPal buttons when the tab is selected and parent details are valid
  useEffect(() => {
    if (paymentMethod !== "PayPal" || !parentValid || !waiverValid || paypalLoaded.current) return;
    if (!paypalRef.current || !firstItem) return;

    const tryRender = () => {
      if (!window.paypal) { setTimeout(tryRender, 500); return; }
      paypalLoaded.current = true;
      paypalRef.current!.innerHTML = "";

      window.paypal.Buttons({
        style: { layout: "vertical", color: "blue", shape: "pill", label: "pay" },
        createOrder: async () => {
          const res = await api.post("/public/paypal/create-order", {
            programId: firstItem.programId,
            batchId: firstItem.batchId,
            studentCount: itemCount || 1,
            sessionsPerWeek: firstItem.sessionsPerWeek,
            couponCode: coupon?.code ?? undefined,
          });
          if (!res.data.success) throw new Error(res.data.message || "PayPal order creation failed");
          if (typeof res.data.amount === "number") setServerConfirmedAmount(res.data.amount);
          return res.data.orderID;
        },
        onApprove: async (data: { orderID: string }) => {
          setPaying(true);
          setPayError(null);
          try {
            const capture = await api.post("/public/paypal/capture-order", {
              orderID: data.orderID,
              programId: firstItem.programId,
              batchId: firstItem.batchId,
              studentCount: itemCount || 1,
              sessionsPerWeek: firstItem.sessionsPerWeek,
              couponCode: coupon?.code ?? undefined,
            });
            if (!capture.data.success) throw new Error(capture.data.message || "Payment capture failed");
            await submitRegistration("PayPal", capture.data.transactionId);
          } catch (err) {
            setPayError(err instanceof Error ? err.message : "Payment failed.");
            setPaying(false);
          }
        },
        onError: (err: unknown) => {
          console.error("PayPal error:", err);
          setPayError("PayPal encountered an error. Please try again.");
        },
        onCancel: () => { setPayError("Payment cancelled."); },
      }).render(paypalRef.current!);
    };

    tryRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod, parentValid, waiverValid]);

  // Reset PayPal render flag when switching away so it can re-render later
  useEffect(() => {
    if (paymentMethod !== "PayPal") paypalLoaded.current = false;
  }, [paymentMethod]);

  const handleStartCheckout = () => {
    if (!isLoggedIn) { setShowLoginModal(true); return; }
    if (!parentValid) {
      setParentTouched(true);
      document.getElementById("parent-guardian-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!waiverValid) {
      setWaiverError("Please accept the waiver, type your e-signature, and draw your digital signature before choosing payment.");
      document.getElementById("waiver-consent-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    document.getElementById("payment-box")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const inputCls =
    "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/15";

  const finalTotal = serverConfirmedAmount ?? grandTotal;

  // ── Empty cart ──
  if (items.length === 0) {
    return (
      <>
        <Navbar />
        <div className="h-20" />
        <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-6">
          <div className="text-center space-y-5">
            <div className="w-24 h-24 rounded-full bg-[var(--gold)]/10 flex items-center justify-center mx-auto">
              <HiOutlineShoppingCart className="h-12 w-12" style={{ color: "var(--gold)" }} />
            </div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Your cart is empty</h1>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">Browse programs, pick a batch, fill in your student's details, and add registration.</p>
            <button
              onClick={() => navigate("/programs")}
              className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold transition"
              style={{ background: "var(--gold)", color: "var(--outfield)" }}
            >
              Browse Programs <HiOutlineArrowRight className="h-4 w-4" />
            </button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="h-20" />
      <main className="min-h-screen bg-[#f8fafc] text-[#0F172A]">

        {/* Header */}
        <section className="max-w-7xl mx-auto px-6 py-10 sm:py-12">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[var(--gold)] transition"
          >
            <HiOutlineArrowLeft className="h-4 w-4" /> Back
          </button>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--gold)" }}>
                🛒 Your Cart
              </p>
              <h1 className="mt-1 text-3xl font-bold text-[#0F172A]">
                {itemCount} Student Enrollment{itemCount !== 1 ? "s" : ""}
              </h1>
            </div>
            <button
              type="button"
              onClick={clearCart}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-red-500 transition self-start sm:self-center"
            >
              <HiOutlineTrash className="h-4 w-4" /> Clear Cart
            </button>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 pb-16">
          <div className="grid gap-8 xl:grid-cols-[1.3fr_0.7fr]">

            {/* ── Left: Cart Items → Parent Details → Payment ── */}
            <div className="space-y-5">
              {items.map((item) => (
                <div
                  key={item.cartId}
                  className="rounded-[24px] bg-white shadow-md ring-1 ring-slate-200/60 overflow-hidden"
                >
                  {/* Gold top bar */}
                  <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, var(--gold), var(--gold-light))" }} />

                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        {/* Program title */}
                        <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: "var(--gold)" }}>
                          Program
                        </p>
                        <h2 className="text-lg font-bold text-[#0F172A] leading-tight">{item.programTitle}</h2>

                        {/* Batch details */}
                        <div className="mt-3 flex items-center gap-3 flex-wrap">
                          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Batch</p>
                            <p className="mt-0.5 text-xs font-bold text-[#0F172A]">{item.batchName}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Month</p>
                            <p className="mt-0.5 text-xs font-bold text-[#0F172A]">{item.selectedMonth}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Schedule</p>
                            <p className="mt-0.5 text-xs font-bold text-[#0F172A] leading-tight">{item.selectedDays}</p>
                          </div>
                        </div>
                      </div>

                      {/* Price + Remove */}
                      <div className="flex flex-col items-end gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total</p>
                          <p className="text-2xl font-bold mt-0.5" style={{ color: "var(--leather)" }}>${item.fee}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.cartId)}
                          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition"
                          style={{ border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", background: "rgba(239,68,68,0.05)" }}
                        >
                          <HiOutlineTrash className="h-3 w-3" /> Remove
                        </button>
                      </div>
                    </div>

                    {/* Students */}
                    <div className="mt-4" style={{ borderTop: "1px solid var(--pitch-deep)", paddingTop: "16px" }}>
                      <p className="text-xs uppercase tracking-widest font-semibold text-slate-400 mb-3">
                        Students ({item.students.length})
                      </p>
                      <div className="space-y-2">
                        {item.students.map((s, si) => (
                          <div
                            key={si}
                            className="flex items-center justify-between rounded-xl px-4 py-3 text-sm"
                            style={{ background: "var(--pitch-soft)" }}
                          >
                            <div>
                              <span className="font-semibold text-[#0F172A]">
                                {s.firstName} {s.lastName}
                              </span>
                              {s.dob && (
                                <span className="ml-2 text-xs text-slate-500">
                                  DOB: {s.dob}
                                </span>
                              )}
                              {s.gender && (
                                <span className="ml-2 text-xs text-slate-400">· {s.gender}</span>
                              )}
                            </div>
                            <span
                              className="text-xs font-bold rounded-full px-2.5 py-1"
                              style={{ background: "var(--gold)/15", color: "var(--outfield)" }}
                            >
                              ${item.fee}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Item subtotal */}
                    <div className="mt-3 flex justify-end">
                      <p className="text-sm font-bold" style={{ color: "var(--outfield)" }}>
                        Item total: <span style={{ color: "var(--leather)" }}>${(item.fee * item.students.length).toFixed(2)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add more programs */}
              <button
                type="button"
                onClick={() => navigate("/programs")}
                className="w-full rounded-[20px] border-2 border-dashed py-5 text-sm font-semibold transition hover:border-[var(--gold)] hover:text-[var(--gold)]"
                style={{ borderColor: "var(--pitch-deep)", color: "var(--ink-400)" }}
              >
                + Add Another Program
              </button>

              {/* ── Parent / Guardian Details — mandatory, filled right here ── */}
              {isLoggedIn && (
                <div id="parent-guardian-box" className="rounded-[24px] bg-white shadow-md ring-1 ring-slate-200/60 p-6">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--gold)" }}>
                        Parent / Guardian
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-[#0F172A]">Your Details</h2>
                    </div>
                  </div>

                  {user && (
                    <div className="mb-4 rounded-2xl bg-green-50 border border-green-200 p-3 text-xs text-green-700 font-medium">
                      ✅ Signed in as {user.firstName} {user.lastName} — details pre-filled, edit anything below if needed.
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Parent Name <span className="text-red-500">*</span></label>
                        <input type="text" value={parentDetails.parentName} onChange={(e) => updateParent({ parentName: e.target.value })} placeholder="Full name" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Email <span className="text-red-500">*</span></label>
                        <input type="email" value={parentDetails.email} onChange={(e) => updateParent({ email: e.target.value })} placeholder="parent@example.com" className={inputCls} />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Phone <span className="text-red-500">*</span></label>
                        <input type="tel" value={parentDetails.phone} onChange={(e) => updateParent({ phone: e.target.value })} placeholder="(123) 456-7890" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">City <span className="text-red-500">*</span></label>
                        <input type="text" value={parentDetails.city} onChange={(e) => updateParent({ city: e.target.value })} placeholder="San Jose" className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Street Address <span className="text-red-500">*</span></label>
                      <input type="text" value={parentDetails.address} onChange={(e) => updateParent({ address: e.target.value })} placeholder="123 Maple Avenue" className={inputCls} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">State <span className="text-red-500">*</span></label>
                        <input type="text" value={parentDetails.state} onChange={(e) => updateParent({ state: e.target.value })} placeholder="CA" maxLength={2} className={inputCls} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-700">ZIP Code <span className="text-red-500">*</span></label>
                        <input type="text" value={parentDetails.zip} onChange={(e) => updateParent({ zip: e.target.value })} placeholder="95123" className={inputCls} />
                      </div>
                    </div>
                    {parentTouched && !parentValid && (
                      <p className="text-xs text-amber-600">Name, email, phone, and full address (street, city, state, ZIP) are required before you can pay.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Payment — embedded, no separate page ── */}
              {isLoggedIn && (
                <div id="waiver-consent-box">
                  <WaiverConsent
                    accepted={waiverAccepted}
                    signature={waiverSignature}
                    drawnSignature={waiverDrawnSignature}
                    guardianName={parentDetails.parentName || (user ? `${user.firstName} ${user.lastName}` : "")}
                    error={waiverError}
                    onAcceptedChange={(accepted) => {
                      setWaiverAccepted(accepted);
                      if (accepted) setWaiverError(null);
                    }}
                    onSignatureChange={(signature) => {
                      setWaiverSignature(signature);
                      if (signature.trim()) setWaiverError(null);
                    }}
                    onDrawnSignatureChange={(signature) => {
                      setWaiverDrawnSignature(signature);
                      if (signature) setWaiverError(null);
                    }}
                  />
                </div>
              )}

              {isLoggedIn && (
                <div id="payment-box" className="rounded-[24px] bg-white shadow-md ring-1 ring-slate-200/60 p-6">
                  <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--gold)" }}>Payment</p>
                  <h2 className="mt-1 text-xl font-bold text-[#0F172A]">Choose how to pay</h2>

                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    {(["PayPal", "Stripe", "Check"] as PaymentMethod[]).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => {
                          if (!parentValid) { setParentTouched(true); document.getElementById("parent-guardian-box")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
                          if (!waiverValid) { setWaiverError("Please accept the waiver, type your e-signature, and draw your digital signature before choosing payment."); document.getElementById("waiver-consent-box")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
                          setPaymentMethod(method);
                        }}
                        className={`flex flex-col items-center gap-3 rounded-[20px] border p-6 text-center transition ${paymentMethod === method ? "border-[var(--gold)] bg-[var(--gold)]/10 shadow-md" : "border-slate-200 bg-slate-50 hover:border-[var(--gold)]"}`}
                      >
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${method === "PayPal" ? "bg-blue-600" : method === "Stripe" ? "bg-[#635BFF]" : "bg-slate-700"}`}>
                          {method === "PayPal" ? "P" : method === "Stripe" ? "S" : "$"}
                        </div>
                        <div>
                          <p className="text-base font-bold text-[#0F172A]">{method}</p>
                          <p className="mt-1 text-xs text-slate-500">{method === "PayPal" ? "Fast online payment" : method === "Stripe" ? "Pay securely by card" : "Pay by physical check"}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {!parentValid && (
                    <p className="mt-3 text-xs text-amber-600">Fill in your parent/guardian details above to continue.</p>
                  )}

                  {/* PayPal Buttons */}
                  {paymentMethod === "PayPal" && parentValid && waiverValid && (
                    <div className="mt-5 rounded-2xl border border-slate-200 p-5">
                      <p className="text-sm uppercase tracking-widest text-slate-500 mb-3">PayPal — Click to Pay</p>
                      <div ref={paypalRef} className="min-h-[120px] flex items-center justify-center">
                        <p className="text-slate-400 text-sm">Loading PayPal...</p>
                      </div>
                      <div className="mt-4 rounded-2xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-700">
                        Click the PayPal button above. You'll be redirected to PayPal to complete payment securely.
                      </div>
                    </div>
                  )}

                  {/* Stripe Card Payment */}
                  {paymentMethod === "Stripe" && parentValid && waiverValid && firstItem && (
                    <div className="mt-5">
                      <StripePaymentBox
                        programId={firstItem.programId}
                        batchId={firstItem.batchId}
                        studentCount={itemCount || 1}
                        sessionsPerWeek={firstItem.sessionsPerWeek}
                        couponCode={coupon?.code ?? undefined}
                        disabled={paying}
                        onAmountConfirmed={setServerConfirmedAmount}
                        onSuccess={(paymentIntentId) => submitRegistration("Stripe", paymentIntentId)}
                      />
                    </div>
                  )}

                  {/* Check Form */}
                  {paymentMethod === "Check" && parentValid && waiverValid && (
                    <div className="mt-5 rounded-2xl border border-slate-200 p-5">
                      <h3 className="text-base font-semibold text-[#0F172A]">Check Information</h3>
                      <div className="mt-4 space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <label className="block text-sm font-semibold text-slate-700">Make Check Payable To <span className="text-red-500">*</span></label>
                          <input type="text" value={checkPayableTo} onChange={(e) => setCheckPayableTo(e.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[var(--gold)]" />
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <label className="block text-sm font-semibold text-slate-700">Check Number (optional)</label>
                          <input type="text" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} placeholder="1234" className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[var(--gold)]" />
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                        <strong>Instructions:</strong> Mail your check within 5 business days. Your spot is held for 7 days.
                      </div>
                      <button
                        type="button"
                        onClick={submitCheck}
                        disabled={paying || !checkPayableTo.trim()}
                        className="mt-5 inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-40 transition w-full"
                        style={{ background: "var(--gold)" }}
                      >
                        {paying ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Processing...</> : `Submit — $${finalTotal.toFixed(2)}`}
                      </button>
                    </div>
                  )}

                  {payError && (
                    <div className="mt-4 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">{payError}</div>
                  )}
                </div>
              )}
            </div>

            {/* ── Right: Summary + Coupon ── */}
            <aside className="space-y-5 xl:sticky xl:top-24 self-start">

              {/* Coupon Box */}
              <div className="rounded-[24px] bg-white p-6 shadow-md ring-1 ring-slate-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <HiOutlineTicket className="h-5 w-5" style={{ color: "var(--gold)" }} />
                  <p className="text-sm font-bold text-[#0F172A]">Have a coupon?</p>
                </div>

                {coupon ? (
                  <div className="rounded-2xl bg-green-50 border border-green-200 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-green-700">{coupon.code}</p>
                        {coupon.description && <p className="mt-0.5 text-xs text-green-600">{coupon.description}</p>}
                        <p className="mt-1 text-sm font-semibold text-green-700">You save ${couponDiscount.toFixed(2)}!</p>
                      </div>
                      <button type="button" onClick={handleRemoveCoupon} className="text-green-400 hover:text-red-500 transition">
                        <HiOutlineXCircle className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                        onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                        placeholder="Enter code"
                        maxLength={30}
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--gold)] uppercase tracking-wider transition"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponInput.trim()}
                        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition"
                        style={{ background: "var(--gold)" }}
                      >
                        {couponLoading ? "..." : "Apply"}
                      </button>
                    </div>
                    {couponError && <p className="text-xs text-red-500 font-medium">{couponError}</p>}
                    <p className="text-xs text-slate-400">One coupon per order.</p>

                    {availableCoupons.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Available Coupons</p>
                        {availableCoupons.map((c: any) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => { setCouponInput(c.code); setCouponError(null); }}
                            className="w-full text-left rounded-xl border border-dashed px-3 py-2.5 text-sm transition hover:bg-[var(--gold)]/5"
                            style={{ borderColor: "var(--gold)" }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold tracking-wider" style={{ color: "var(--gold)" }}>{c.code}</span>
                              <span className="text-xs font-semibold text-slate-700">
                                {c.type === "PERCENTAGE" ? `${c.value}% off` : `$${c.value} off`}
                              </span>
                            </div>
                            {c.description && <p className="mt-0.5 text-xs text-slate-500">{c.description}</p>}
                            {c.minAmount > 0 && <p className="mt-0.5 text-xs font-medium text-amber-600">Min. order: ${c.minAmount}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Order Summary */}
              <div className="rounded-[24px] bg-white p-6 shadow-md ring-1 ring-slate-200/60">
                <p className="text-xs uppercase tracking-widest font-semibold mb-4" style={{ color: "var(--gold)" }}>
                  Order Summary
                </p>

                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.cartId} className="flex justify-between text-sm">
                      <span className="text-slate-600 truncate max-w-[65%]">
                        {item.programTitle} × {item.students.length}
                      </span>
                      <span className="font-semibold text-[#0F172A]">${(item.fee * item.students.length).toFixed(2)}</span>
                    </div>
                  ))}

                  <div className="flex justify-between text-sm pt-2" style={{ borderTop: "1px solid var(--pitch-deep)" }}>
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-semibold text-[#0F172A]">${subtotal.toFixed(2)}</span>
                  </div>

                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-sm font-semibold text-green-600">
                      <span>Discount ({coupon?.code})</span>
                      <span>− ${couponDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="rounded-2xl p-4 mt-2" style={{ background: "var(--pitch-soft)" }}>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Grand Total</p>
                    <p className="mt-1 text-3xl font-bold text-[#0F172A]">${finalTotal.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Start checkout — scrolls to / unlocks parent details + payment below */}
              {!isLoggedIn || !paymentMethod ? (
                <button
                  type="button"
                  onClick={handleStartCheckout}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full py-4 text-base font-bold transition shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, var(--gold), var(--gold-light))", color: "var(--outfield)" }}
                >
                  Proceed to Checkout <HiOutlineArrowRight className="h-5 w-5" />
                </button>
              ) : null}

              {!isLoggedIn && (
                <p className="text-xs text-slate-400 text-center">You'll sign in before completing purchase.</p>
              )}

              <p className="text-xs text-slate-400 text-center">
                Secure checkout · Your cart is saved if you leave
              </p>
            </aside>
          </div>
        </section>
      </main>
      <Footer />

      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => setShowLoginModal(false)}
        />
      )}
    </>
  );
}
