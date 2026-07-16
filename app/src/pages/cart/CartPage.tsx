// ============================================================
//  CartPage — payment-focused checkout after /review-order.
//  Parent details and coupon application live on /review-order; this page
//  shows a quick registration summary, waiver consent, and payment options.
// ============================================================
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { useRegistration } from "../../context/RegistrationContext";
import api from "../../api/axios";
import WaiverConsent from "../../components/registration/WaiverConsent";
import { WAIVER_AGREEMENT_VERSION } from "../../constants/waiverAgreement";
import StripePaymentBox from "../../components/payments/StripePaymentBox";
import {
  HiOutlineArrowRight, HiOutlineShoppingCart,
} from "react-icons/hi2";
import { HiOutlineArrowLeft } from "react-icons/hi";

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";

function splitScheduleItems(selectedDays?: string): string[] {
  return (selectedDays ?? "")
    .split(/\s*(?:\+|\||,|\n)\s*/)
    .map((day) => day.trim())
    .filter(Boolean);
}

type PaymentMethod = "PayPal" | "Stripe" | "Check" | "";

// ── CartPage ──────────────────────────────────────────────────────────────────
export default function CartPage() {
  const navigate = useNavigate();
  const { isLoggedIn, user, token, acceptSession } = useAuth();
  const {
    items, coupon, couponDiscount,
    clearCart,
    subtotal, grandTotal, itemCount,
  } = useCart();
  const {
    parentDetails,
    createAccount,
    accountPassword,
    accountPasswordConfirm,
    setCreateAccount,
    setCheckoutMode,
    setAccountPassword,
    setAccountPasswordConfirm,
  } = useRegistration();

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
  const [accountPromptOpen, setAccountPromptOpen] = useState(false);
  const paypalRef = useRef<HTMLDivElement>(null);
  const paypalLoaded = useRef(false);
  const paymentCartItems = useMemo(() => items.map((item) => {
    const effectiveSessionsPerWeek = Math.max(item.sessionsPerWeek || 1, splitScheduleItems(item.selectedDays).length || 1);
    return {
      programId: item.programId,
      programTitle: item.programTitle,
      batchId: item.batchId,
      batchName: item.batchName,
      studentCount: item.students.length || 1,
      sessionsPerWeek: effectiveSessionsPerWeek,
      selectedDays: item.selectedDays,
      selectedMonth: item.selectedMonthOption ?? { label: item.selectedMonth },
      selectedMonthLabel: item.selectedMonth,
      fee: item.fee,
      students: item.students,
    };
  }), [items]);
  const paymentCartKey = JSON.stringify(paymentCartItems);

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
  const accountPasswordValid =
    !createAccount ||
    (accountPassword.length >= 6 && accountPassword === accountPasswordConfirm);

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
    if (createAccount && !accountPasswordValid) {
      setPayError(accountPassword.length < 6 ? "Password must be at least 6 characters." : "Passwords do not match.");
      return;
    }
    setPaying(true);
    try {
      const parentInfo = user
        ? { parentName: `${user.firstName} ${user.lastName}`, email: user.email, phone: user.phone, address: parentDetails.address, city: parentDetails.city, state: parentDetails.state, zip: parentDetails.zip }
        : parentDetails;

      // Flatten every cart item's students into one list. Each student keeps
      // a reference to their own batch so mixed-program carts still price
      // and record correctly.
      const allStudents = items.flatMap((item) =>
        item.students.map((s) => {
          const effectiveSessionsPerWeek = Math.max(item.sessionsPerWeek || 1, splitScheduleItems(item.selectedDays).length || 1);
          return {
            ...s,
            selectedBatch: {
              _id: item.batchId,
              name: item.batchName,
              days: item.selectedDays,
              timing: item.selectedDays,
              fee: item.fee,
              seats: 999,
              sessionsPerWeek: effectiveSessionsPerWeek,
              selectedMonth: item.selectedMonthOption ?? { label: item.selectedMonth, price: item.fee / effectiveSessionsPerWeek },
            },
          };
        })
      );
      const firstItemSessionsPerWeek = Math.max(firstItem.sessionsPerWeek || 1, splitScheduleItems(firstItem.selectedDays).length || 1);

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
            sessionsPerWeek: firstItemSessionsPerWeek,
            selectedMonth: firstItem.selectedMonthOption ?? { label: firstItem.selectedMonth, price: firstItem.fee / firstItemSessionsPerWeek },
          },
          students: allStudents,
          parent: parentInfo,
          parentId: user ? user.id : undefined,
          sessionsPerWeek: firstItemSessionsPerWeek,
          cartItems: paymentCartItems,
          cartCheckoutMode: "cart",
          paymentMethod: method,
          transactionId,
          checkNumber: method === "Check" ? checkNumber : undefined,
          checkoutMode: user || createAccount ? "account" : "guest",
          accountPassword: !isLoggedIn && createAccount ? accountPassword : undefined,
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
      if (response.data.token && response.data.parent) {
        acceptSession(response.data.token, response.data.parent);
      }
      clearCart();
      sessionStorage.setItem("cca:lastRegistration", JSON.stringify(response.data));
      navigate("/success", { state: response.data });
    } catch (err: any) {
      setPayError(err?.response?.data?.message || (err instanceof Error ? err.message : "Registration failed. Please try again."));
    } finally {
      setPaying(false);
    }
  };

  const submitCheck = async () => {
    if (!parentValid) { navigate("/review-order"); return; }
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

  // Render PayPal buttons when the tab is selected and checkout details are valid
  useEffect(() => {
    if (paymentMethod !== "PayPal" || !parentValid || !waiverValid || !accountPasswordValid) return;
    if (!paypalRef.current || !firstItem) return;

    const tryRender = () => {
      if (!window.paypal) { setTimeout(tryRender, 500); return; }
      paypalLoaded.current = true;
      paypalRef.current!.innerHTML = "";

      window.paypal.Buttons({
        style: { layout: "vertical", color: "blue", shape: "pill", label: "pay" },
        createOrder: async () => {
          const res = await api.post("/public/paypal/create-order", {
            checkoutMode: "cart",
            cartItems: paymentCartItems,
            couponCode: coupon?.code ?? undefined,
          });
          if (!res.data.success) throw new Error(res.data.message || "PayPal order creation failed");
          return res.data.orderID;
        },
        onApprove: async (data: { orderID: string }) => {
          setPaying(true);
          setPayError(null);
          try {
            const capture = await api.post("/public/paypal/capture-order", {
              orderID: data.orderID,
              checkoutMode: "cart",
              cartItems: paymentCartItems,
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
  }, [paymentMethod, parentValid, waiverValid, accountPasswordValid, paymentCartKey, coupon?.code]);

  // Reset PayPal render flag when switching away so it can re-render later
  useEffect(() => {
    if (paymentMethod !== "PayPal") paypalLoaded.current = false;
  }, [paymentMethod]);

  const finalTotal = grandTotal;
  const effectiveCheckoutMode = user || createAccount ? "account" : "guest";

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

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--gold)" }}>
                Checkout
              </p>
              <h1 className="mt-1 text-3xl font-bold text-[#0F172A]">Payment &amp; Waiver</h1>
            </div>
            <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
              {itemCount} student{itemCount !== 1 ? "s" : ""}
            </span>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 pb-16">
          <div className="grid gap-8 xl:grid-cols-[1.3fr_0.7fr]">

            {/* ── Left: Cart Items → Parent Details → Payment ── */}
            <div className="space-y-5">
              <div className={`rounded-2xl border p-4 text-sm ${
                effectiveCheckoutMode === "guest"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-green-200 bg-green-50 text-green-700"
              }`}>
                {effectiveCheckoutMode === "guest"
                  ? "You are checking out as a guest. This registration will not be linked to a parent portal login."
                  : "This registration will be tracked as a registered parent checkout."}
              </div>

              {/* ── Payment — embedded, no separate page ── */}
              {!user && !createAccount && (
                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-md">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--gold)" }}>Parent Portal</p>
                      <h2 className="mt-1 text-lg font-bold text-[#0F172A]">Create an account before payment?</h2>
                      <p className="mt-1 text-sm text-slate-500">Add a password now to track registrations, students, attendance, and messages later.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountPromptOpen(true);
                        setCreateAccount(true);
                        setCheckoutMode("account");
                        setPayError(null);
                      }}
                      className="rounded-full bg-[var(--gold)] px-5 py-2 text-sm font-semibold text-[var(--outfield)] shadow-sm transition hover:bg-[var(--gold-light)]"
                    >
                      Add Password
                    </button>
                  </div>
                </div>
              )}

              {!user && createAccount && (
                <div className="rounded-[24px] border border-green-200 bg-green-50 p-5 shadow-md">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest font-semibold text-green-700">Parent Portal</p>
                      <h2 className="mt-1 text-lg font-bold text-[#0F172A]">Account will be created after payment</h2>
                      <p className="mt-1 text-sm text-green-700">Use these password fields to activate the parent login with this registration.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCreateAccount(false);
                        setCheckoutMode("guest");
                        setAccountPassword("");
                        setAccountPasswordConfirm("");
                        setAccountPromptOpen(false);
                        setPayError(null);
                      }}
                      className="text-left text-xs font-semibold text-green-700 underline sm:text-right"
                    >
                      Continue as guest
                    </button>
                  </div>
                  {(accountPromptOpen || createAccount) && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Password</label>
                        <input
                          type="password"
                          value={accountPassword}
                          onChange={(e) => {
                            setAccountPassword(e.target.value);
                            setPayError(null);
                          }}
                          placeholder="At least 6 characters"
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/15"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Confirm Password</label>
                        <input
                          type="password"
                          value={accountPasswordConfirm}
                          onChange={(e) => {
                            setAccountPasswordConfirm(e.target.value);
                            setPayError(null);
                          }}
                          placeholder="Repeat password"
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/15"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

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

              <div id="payment-box" className="rounded-[24px] bg-white shadow-md ring-1 ring-slate-200/60 p-6">
                  <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--gold)" }}>Payment</p>
                  <h2 className="mt-1 text-xl font-bold text-[#0F172A]">Choose how to pay</h2>

                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    {(["PayPal", "Stripe", "Check"] as PaymentMethod[]).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => {
                          if (!parentValid) { navigate("/review-order"); return; }
                          if (!waiverValid) { setWaiverError("Please accept the waiver, type your e-signature, and draw your digital signature before choosing payment."); document.getElementById("waiver-consent-box")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
                          if (!accountPasswordValid) { setPayError(accountPassword.length < 6 ? "Password must be at least 6 characters." : "Passwords do not match."); return; }
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
                    <p className="mt-3 text-xs text-amber-600">Parent details are incomplete. Return to review-order to finish them before payment.</p>
                  )}

                  {/* PayPal Buttons */}
                  {paymentMethod === "PayPal" && parentValid && waiverValid && accountPasswordValid && (
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
                  {paymentMethod === "Stripe" && parentValid && waiverValid && accountPasswordValid && firstItem && (
                    <div className="mt-5">
                      <StripePaymentBox
                        programId={firstItem.programId}
                        batchId={firstItem.batchId}
                        studentCount={itemCount || 1}
                        sessionsPerWeek={firstItem.sessionsPerWeek}
                        cartItems={paymentCartItems}
                        checkoutMode="cart"
                        couponCode={coupon?.code ?? undefined}
                        disabled={paying}
                        onSuccess={(paymentIntentId) => submitRegistration("Stripe", paymentIntentId)}
                      />
                    </div>
                  )}

                  {/* Check Form */}
                  {paymentMethod === "Check" && parentValid && waiverValid && accountPasswordValid && (
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
                        disabled={paying || !checkPayableTo.trim() || !accountPasswordValid}
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
            </div>

            {/* ── Right: Summary + Coupon ── */}
            <aside className="space-y-5 xl:sticky xl:top-24 self-start">

              {/* Registration Quick Summary */}
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
                          Order Summary
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
                            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs font-bold text-[#0F172A] leading-tight">
                              {splitScheduleItems(item.selectedDays).length > 0 ? (
                                splitScheduleItems(item.selectedDays).map((day) => (
                                  <li key={day}>{day}</li>
                                ))
                              ) : (
                                <li className="list-none -ml-4">—</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="flex flex-col items-end gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total</p>
                          <p className="text-2xl font-bold mt-0.5" style={{ color: "var(--leather)" }}>${item.fee}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-widest font-semibold text-slate-400">Parent / Guardian</p>
                      <p className="mt-1 text-sm font-bold text-[#0F172A]">{parentDetails.parentName || "Parent details"}</p>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        {parentDetails.email && <p>{parentDetails.email}</p>}
                        {parentDetails.phone && <p>{parentDetails.phone}</p>}
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
                    <div className="mt-4 rounded-2xl p-4" style={{ background: "var(--pitch-soft)" }}>
                      <p className="text-xs uppercase tracking-widest text-slate-500">Grand Total</p>
                      <p className="mt-1 text-3xl font-bold text-[#0F172A]">${finalTotal.toFixed(2)}</p>
                      {couponDiscount > 0 && (
                        <p className="mt-1 text-xs font-semibold text-green-600">
                          Includes discount {coupon?.code ? `(${coupon.code})` : ""}: -${couponDiscount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <p className="text-xs text-slate-400 text-center">
                Secure checkout. Your cart is saved if you leave.
              </p>
            </aside>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
