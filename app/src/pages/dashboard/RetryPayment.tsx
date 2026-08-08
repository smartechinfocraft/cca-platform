import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { HiOutlineArrowLeft, HiOutlineLockClosed } from "react-icons/hi2";
import toast from "react-hot-toast";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import StripePaymentBox from "../../components/payments/StripePaymentBox";
import {
  capturePurchasePayPalRetry,
  finalizePurchaseStripeRetry,
  getPurchaseDetail,
  startPurchasePaymentRetry,
} from "../../services/parentDashboardService";
import type { Registration } from "../../types/parentDashboard";

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : "Could not start the payment. Please try again.";
}

export default function RetryPayment() {
  const { id = "" } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const paypalRef = useRef<HTMLDivElement>(null);
  const paypalRendered = useRef(false);
  const paypalOrderRef = useRef<string | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const complete = () => {
    toast.success("Payment completed successfully.");
    navigate("/dashboard/purchases", { replace: true });
  };

  useEffect(() => {
    if (!token || !id) return;
    getPurchaseDetail(token, id)
      .then(({ registration: value }) => setRegistration(value))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, token]);

  useEffect(() => {
    if (registration?.paymentMethod !== "PAYPAL" || !token || paypalRendered.current) return;
    const render = () => {
      if (!window.paypal || !paypalRef.current || paypalRendered.current) return;
      paypalRendered.current = true;
      paypalRef.current.innerHTML = "";
      window.paypal.Buttons({
        createOrder: async () => {
          const started = await startPurchasePaymentRetry(token, registration._id);
          paypalOrderRef.current = started.orderID;
          return started.orderID;
        },
        onApprove: async (data) => {
          await capturePurchasePayPalRetry(token, registration._id, data.orderID);
          complete();
        },
        onError: (err) => {
          if (paypalOrderRef.current) {
            api.post("/public/paypal/report-payment-failure", {
              registrationId: registration._id,
              orderID: paypalOrderRef.current,
              reason: "PayPal checkout reported an unsuccessful payment attempt.",
            }).catch(() => undefined);
          }
          paypalRendered.current = false;
          setError(errorMessage(err));
        },
        onCancel: () => {
          if (paypalOrderRef.current) api.post("/public/paypal/report-payment-failure", { registrationId: registration._id, orderID: paypalOrderRef.current, reason: "PayPal checkout was cancelled before completion." }).catch(() => undefined);
          setError("PayPal checkout was cancelled. You can try again.");
        },
      }).render(paypalRef.current);
    };
    if (window.paypal) { render(); return; }
    if (!PAYPAL_CLIENT_ID) { setError("PayPal is not configured."); return; }
    const existing = document.querySelector<HTMLScriptElement>('script[src*="paypal.com/sdk/js"]');
    if (existing) { existing.addEventListener("load", render, { once: true }); return; }
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;
    script.async = true;
    script.onload = render;
    script.onerror = () => setError("Could not load PayPal.");
    document.body.appendChild(script);
  }, [registration, token]);

  if (loading) return <div className="rounded-3xl bg-white p-8 animate-pulse h-72" />;
  if (error && !registration) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>;
  if (!registration) return null;

  const eligible = ["PAYPAL", "STRIPE"].includes(registration.paymentMethod)
    && registration.paymentStatus !== "SUCCESS"
    && !["CONFIRMED", "PAID", "CANCELLED", "REFUNDED"].includes(registration.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/dashboard/purchases" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
        <HiOutlineArrowLeft className="h-4 w-4" /> Back to purchases
      </Link>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">Finish Payment</h1>
        <p className="mt-1 text-slate-500">Retry payment for the existing registration only.</p>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <HiOutlineLockClosed className="h-5 w-5" /> Registration details are locked
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 text-sm">
          <div><p className="text-slate-400">Registration</p><p className="font-semibold text-slate-900">{registration.registrationNumber}</p></div>
          <div><p className="text-slate-400">Program</p><p className="font-semibold text-slate-900">{registration.programId?.title || "CCA Program"}</p></div>
          <div><p className="text-slate-400">Students</p><p className="font-semibold text-slate-900">{registration.students.map(s => `${s.firstName} ${s.lastName}`).join(", ")}</p></div>
          <div><p className="text-slate-400">Payment method</p><p className="font-semibold text-slate-900">{registration.paymentMethod}</p></div>
          <div><p className="text-slate-400">Batch</p><p className="font-semibold text-slate-900">{registration.batches.map(b => b.title).filter(Boolean).join(", ") || "As originally selected"}</p></div>
          <div><p className="text-slate-400">Amount due</p><p className="text-xl font-bold text-slate-900">${registration.totalAmount.toFixed(2)}</p></div>
        </div>
      </div>

      {!eligible ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">This registration is no longer eligible for an online payment retry.</div>
      ) : (
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
          {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {registration.paymentMethod === "PAYPAL" ? (
            <><p className="mb-4 font-semibold text-slate-900">Pay securely with PayPal</p><div ref={paypalRef} className="min-h-[120px]" /></>
          ) : token ? (
            <StripePaymentBox
              programId={registration.programId?._id}
              studentCount={registration.students.length}
              prepareRegistration={async () => ({ registrationId: registration._id })}
              startPayment={() => startPurchasePaymentRetry(token, registration._id)}
              finalizePayment={(_, intentId) => finalizePurchaseStripeRetry(token, registration._id, intentId)}
              pendingStorageKey={`cca:retryStripe:${registration._id}`}
              onSuccess={complete}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
