import { useState, useEffect, useRef } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { useNavigate } from "react-router-dom";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import api from "../../api/axios";
import { useRegistration, type PaymentMethod } from "../../context/RegistrationContext";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import WaiverConsent from "../../components/registration/WaiverConsent";
import { WAIVER_AGREEMENT_VERSION } from "../../constants/waiverAgreement";
import StripePaymentBox from "../../components/payments/StripePaymentBox";

// PayPal SDK types are declared globally in src/types/paypal.d.ts

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";

function PaymentPage() {
  const navigate = useNavigate();
  const {
    selectedProgram, selectedBatch, students,
    parentDetails, totalAmount,
    paymentMethod, setPaymentMethod,
    checkoutMode,
    appliedCoupon,
    couponDiscount,
  } = useRegistration();
  const { user, token } = useAuth();
  const { clearCart } = useCart();

  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [checkPayableTo, setCheckPayableTo] = useState("California Cricket Academy");
  const [checkNumber, setCheckNumber]   = useState("");
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [waiverSignature, setWaiverSignature] = useState("");
  const [waiverDrawnSignature, setWaiverDrawnSignature] = useState("");
  const [waiverError, setWaiverError] = useState<string | null>(null);
  const paypalRef    = useRef<HTMLDivElement>(null);
  const paypalLoaded = useRef(false);
  const [serverConfirmedAmount, setServerConfirmedAmount] = useState<number | null>(null);

  // Sum each student's individual batch fee (they may have different batches)
  const studentFees    = students.map(
    (s: any) => s.selectedBatch?.fee ?? selectedBatch?.fee ?? selectedProgram?.basePrice ?? 0
  );
  const perStudentFee  = selectedBatch?.fee ?? selectedProgram?.basePrice ?? 0; // for display fallback
  const estimatedTotal = totalAmount || Math.max(0, studentFees.reduce((sum: number, f: number) => sum + f, 0) - couponDiscount);
  const grandTotal     = serverConfirmedAmount ?? estimatedTotal;
  const waiverValid = waiverAccepted && Boolean(waiverSignature.trim()) && Boolean(waiverDrawnSignature);

  // BUG FIX: serverConfirmedAmount is a one-time price quote fetched when
  // PayPal/Stripe's create-order call runs. It used to stay in state
  // forever, so going back and changing the program/batch/students, or
  // applying/removing a coupon, or switching PayPal to Stripe to Check kept
  // showing that old quote (e.g. "Fee/student $870" but "Total $430" left
  // over from a previous, different program). Clearing it whenever any of
  // the underlying inputs change means the displayed total always reflects
  // either the live client-side estimate or a quote that was actually
  // fetched for the CURRENT selection.
  useEffect(() => {
    setServerConfirmedAmount(null);
  }, [selectedProgram, selectedBatch, students, appliedCoupon, paymentMethod]);

  // Load PayPal SDK
  useEffect(() => {
    if (!PAYPAL_CLIENT_ID || window.paypal) return;
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  // Render PayPal buttons when tab selected
  useEffect(() => {
    if (paymentMethod !== "PayPal" || !waiverValid || paypalLoaded.current) return;
    if (!paypalRef.current) return;

    const tryRender = () => {
      if (!window.paypal) { setTimeout(tryRender, 500); return; }
      paypalLoaded.current = true;
      paypalRef.current!.innerHTML = "";

      window.paypal.Buttons({
        style: { layout: "vertical", color: "blue", shape: "pill", label: "pay" },
        createOrder: async () => {
          // couponCode is sent so the backend computes the discounted price
          const res = await api.post("/public/paypal/create-order", {
            programId:       selectedProgram?._id,
            batchId:         selectedBatch?._id,
            studentCount:    students.length || 1,
            sessionsPerWeek: selectedBatch?.sessionsPerWeek,
            couponCode:      appliedCoupon?.code ?? undefined,
          });
          if (!res.data.success) throw new Error(res.data.message || "PayPal order creation failed");
          if (typeof res.data.amount === "number") setServerConfirmedAmount(res.data.amount);
          return res.data.orderID;
        },
        onApprove: async (data: { orderID: string }) => {
          setLoading(true);
          setError(null);
          try {
            const capture = await api.post("/public/paypal/capture-order", {
              orderID:         data.orderID,
              programId:       selectedProgram?._id,
              batchId:         selectedBatch?._id,
              studentCount:    students.length || 1,
              sessionsPerWeek: selectedBatch?.sessionsPerWeek,
              couponCode:      appliedCoupon?.code ?? undefined,
            });
            if (!capture.data.success) throw new Error(capture.data.message || "Payment capture failed");
            await submitRegistration("PayPal", capture.data.transactionId);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Payment failed.");
            setLoading(false);
          }
        },
        onError: (err: unknown) => {
          console.error("PayPal error:", err);
          setError("PayPal encountered an error. Please try again.");
        },
        onCancel: () => { setError("Payment cancelled."); },
      }).render(paypalRef.current!);
    };

    tryRender();
  }, [paymentMethod, grandTotal, waiverValid]);

  // Reset paypal when switching away and back
  useEffect(() => {
    if (paymentMethod !== "PayPal") { paypalLoaded.current = false; }
  }, [paymentMethod]);

  const submitRegistration = async (method: string, transactionId?: string) => {
    if (!waiverValid) {
      setWaiverError("Please accept the waiver, type your e-signature, and draw your digital signature before registering.");
      return;
    }
    setError(null);
    setWaiverError(null);
    setLoading(true);
    try {
      // Always send the actual billing address the person confirmed on the
      // Review Order step (context `parentDetails`) — previously this sent
      // blank address fields for logged-in users, even though ReviewOrder
      // collects/pre-fills a real address. Address is now required by the
      // backend, so this must carry through.
      const parentInfo = user
        ? { parentName: `${user.firstName} ${user.lastName}`, email: user.email, phone: user.phone, address: parentDetails.address, city: parentDetails.city, state: parentDetails.state, zip: parentDetails.zip }
        : parentDetails;

      const response = await api.post(
        "/public/register",
        {
          selectedProgram,
          selectedBatch,
          students,
          parent:          parentInfo,
          parentId:        user ? user.id : undefined,
          sessionsPerWeek: selectedBatch?.sessionsPerWeek,
          paymentMethod:   method,
          transactionId,
          checkNumber:     method === "Check" ? checkNumber : undefined,
          checkoutMode,
          couponCode:      appliedCoupon?.code ?? undefined,   // ← pass coupon to backend
          waiverConsent: {
            accepted: waiverAccepted,
            signature: waiverSignature.trim(),
            drawnSignature: waiverDrawnSignature,
            agreementVersion: WAIVER_AGREEMENT_VERSION,
          },
        },
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );
      navigate("/success", { state: response.data });
      // Registration succeeded — empty the cart so a refreshed/returning
      // visit to /cart doesn't show items that were just purchased.
      clearCart();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitCheck = async () => {
    if (!waiverValid) {
      setWaiverError("Please accept the waiver, type your e-signature, and draw your digital signature before registering.");
      return;
    }
    if (!checkPayableTo.trim()) { setError("Please fill check details."); return; }
    await submitRegistration("Check");
  };

  return (
    <>
      <Navbar />
      <div className="h-20" />
      <main className="min-h-screen bg-[#f8fafc] text-[#0F172A]">
      <section className="max-w-7xl mx-auto px-6 py-10 sm:py-14">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#A33B2B] transition">
          <HiOutlineArrowLeft className="h-4 w-4" /> Back to Review
        </button>

        <div className="mt-6 rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-200/60 sm:p-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-widest text-[var(--gold)]">Step 5 — Payment</p>
              <h1 className="mt-2 text-3xl font-bold text-[#0F172A]">Complete Your Payment</h1>
              <p className="mt-2 text-slate-600 text-sm">Choose PayPal, Stripe card, or Check to finalize enrollment.</p>
            </div>
            <div className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">🔒 Secure Checkout</div>
          </div>
          <div className="mt-6 overflow-hidden rounded-full bg-slate-100 h-2">
            <div className="h-2 rounded-full bg-green-500" style={{ width: "100%" }} />
          </div>
          <p className="mt-2 text-xs text-right text-slate-400">Final Step</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
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

            {/* Method Selection */}
            <div className="rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-200/70">
              <p className="text-sm uppercase tracking-widest text-slate-500">Payment Method</p>
              <h2 className="mt-2 text-xl font-semibold text-[#0F172A]">Choose how to pay</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {(["PayPal", "Stripe", "Check"] as PaymentMethod[]).map(method => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      if (!waiverValid) {
                        setWaiverError("Please complete the waiver consent, typed e-signature, and drawn digital signature before choosing payment.");
                        return;
                      }
                      setPaymentMethod(method);
                    }}
                    className={`flex flex-col items-center gap-3 rounded-[20px] border p-6 text-center transition ${paymentMethod === method ? "border-[#A33B2B] bg-[#A33B2B]/10 shadow-md" : "border-slate-200 bg-slate-50 hover:border-[#A33B2B]"}`}>
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
            </div>

            {/* PayPal Buttons */}
            {paymentMethod === "PayPal" && (
              <div className="rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-200/70">
                <p className="text-sm uppercase tracking-widest text-slate-500 mb-3">PayPal — Click to Pay</p>
                {waiverValid ? (
                  <div ref={paypalRef} className="min-h-[120px] flex items-center justify-center">
                    <p className="text-slate-400 text-sm">Loading PayPal...</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Accept the waiver, type your e-signature, and draw your digital signature to unlock PayPal checkout.
                  </div>
                )}
                <div className="mt-4 rounded-2xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-700">
                  Click the PayPal button above. You'll be redirected to PayPal to complete payment securely.
                </div>
              </div>
            )}

            {/* Stripe Card Payment */}
            {paymentMethod === "Stripe" && (
              <div className="rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-200/70">
                {waiverValid ? (
                  <StripePaymentBox
                    programId={selectedProgram?._id}
                    batchId={selectedBatch?._id}
                    studentCount={students.length || 1}
                    sessionsPerWeek={selectedBatch?.sessionsPerWeek}
                    couponCode={appliedCoupon?.code ?? undefined}
                    disabled={loading}
                    onAmountConfirmed={setServerConfirmedAmount}
                    onSuccess={(paymentIntentId) => submitRegistration("Stripe", paymentIntentId)}
                  />
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Accept the waiver, type your e-signature, and draw your digital signature to unlock Stripe checkout.
                  </div>
                )}
              </div>
            )}

            {/* Check Form */}
            {paymentMethod === "Check" && (
              <div className="rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-200/70">
                <p className="text-sm uppercase tracking-widest text-slate-500">Check Payment</p>
                <h2 className="mt-2 text-xl font-semibold text-[#0F172A]">Check Information</h2>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <label className="block text-sm font-semibold text-slate-700">Make Check Payable To <span className="text-red-500">*</span></label>
                    <input type="text" value={checkPayableTo} onChange={e => setCheckPayableTo(e.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#A33B2B]" />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <label className="block text-sm font-semibold text-slate-700">Check Number (optional)</label>
                    <input type="text" value={checkNumber} onChange={e => setCheckNumber(e.target.value)} placeholder="1234" className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#A33B2B]" />
                  </div>
                </div>
                <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                  <strong>Instructions:</strong> Mail your check within 5 business days. Your spot is held for 7 days.
                </div>
                <button type="button" onClick={submitCheck} disabled={loading || !checkPayableTo.trim() || !waiverValid}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#A33B2B] px-8 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-40 transition w-full">
                  {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Processing...</> : `Submit — $${grandTotal.toFixed(2)}`}
                </button>
              </div>
            )}

            {error && <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">{error}</div>}
          </div>

          {/* Sidebar */}
          <aside className="space-y-5 xl:sticky xl:top-24">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-lg">
              <p className="text-sm uppercase tracking-widest text-[#A33B2B]">Order Summary</p>
              <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
                {[
                  { label: "Program",     value: selectedProgram?.title ?? "—" },
                  { label: "Batch",       value: selectedBatch?.name ?? "—" },
                  { label: "Students",    value: String(students.length) },
                  { label: "Fee/student", value: `$${perStudentFee}` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-semibold text-[#0F172A] truncate max-w-[150px] text-right">{value}</span>
                  </div>
                ))}

                {/* Discount line */}
                {appliedCoupon && couponDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 font-semibold">
                    <span>Coupon ({appliedCoupon.code})</span>
                    <span>− ${couponDiscount.toFixed(2)}</span>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Total</p>
                  <p className="mt-1 text-3xl font-bold text-[#0F172A]">${grandTotal.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Applied coupon badge */}
            {appliedCoupon && (
              <div className="rounded-[28px] border border-green-200 bg-green-50 p-5 text-sm text-green-700">
                <p className="font-semibold">🏷️ Coupon applied: {appliedCoupon.code}</p>
                <p className="mt-1 text-xs text-green-600">
                  {appliedCoupon.type === "PERCENTAGE"
                    ? `${appliedCoupon.value}% off`
                    : `$${appliedCoupon.value} off`}
                  {appliedCoupon.description ? ` — ${appliedCoupon.description}` : ""}
                </p>
              </div>
            )}

            <div className="rounded-[28px] border border-green-200 bg-green-50 p-5 text-sm text-green-700">
              <p className="font-semibold">Payment is secure 🔒</p>
              <p className="mt-2 text-xs text-green-600">All transactions are encrypted via PayPal. Your data is never stored.</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
      <Footer />
    </>
  );
}

export default PaymentPage;
