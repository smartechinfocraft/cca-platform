import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

let stripeScriptPromise: Promise<void> | null = null;

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return err instanceof Error ? err.message : fallback;
}

function loadStripeScript() {
  if (window.Stripe) return Promise.resolve();
  if (stripeScriptPromise) return stripeScriptPromise;

  stripeScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.stripe.com/v3/"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Stripe.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Stripe."));
    document.body.appendChild(script);
  });

  return stripeScriptPromise;
}

interface StripePaymentBoxProps {
  programId?: string;
  batchId?: string;
  studentCount: number;
  sessionsPerWeek?: number;
  selectedDays?: string;
  selectedMonth?: string | { label?: string };
  expectedUnitPrice?: number;
  weeklyBatchIds?: string[];
  cartItems?: unknown[];
  checkoutMode?: "cart";
  couponCode?: string;
  disabled?: boolean;
  onAmountConfirmed?: (amount: number) => void;
  onSuccess: (paymentIntentId: string) => Promise<void>;
}

export default function StripePaymentBox({
  programId,
  batchId,
  studentCount,
  sessionsPerWeek,
  selectedDays,
  selectedMonth,
  expectedUnitPrice,
  weeklyBatchIds,
  cartItems,
  checkoutMode,
  couponCode,
  disabled = false,
  onAmountConfirmed,
  onSuccess,
}: StripePaymentBoxProps) {
  const elementId = useRef(`stripe-payment-${Math.random().toString(36).slice(2)}`);
  const paymentElementRef = useRef<StripePaymentElement | null>(null);
  const stripeRef = useRef<StripeClient | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const paymentIntentRef = useRef<{ paymentIntentId: string; clientSecret: string } | null>(null);
  const paidRef = useRef(false);

  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelPendingIntent = () => {
    const pending = paymentIntentRef.current;
    if (!pending || paidRef.current) return;
    paymentIntentRef.current = null;
    api.post("/public/stripe/cancel-payment-intent", pending).catch(() => undefined);
  };

  const resetStripeForm = () => {
    paymentElementRef.current?.unmount();
    paymentElementRef.current = null;
    stripeRef.current = null;
    elementsRef.current = null;
    setReady(false);
    setStarted(false);
  };

  useEffect(() => {
    return () => {
      cancelPendingIntent();
      resetStripeForm();
    };
    // The cleanup intentionally runs when payable context changes, so old
    // unconfirmed intents do not linger if the user edits cart/payment state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, batchId, studentCount, sessionsPerWeek, selectedDays, selectedMonth, expectedUnitPrice, weeklyBatchIds, cartItems, checkoutMode, couponCode]);

  const handleStartCardForm = async () => {
    setError(null);
    setLoadingForm(true);
    try {
      if ((!programId && (!cartItems || cartItems.length === 0)) || !STRIPE_PUBLISHABLE_KEY) {
        throw new Error(!STRIPE_PUBLISHABLE_KEY ? "Stripe is not configured yet." : "Program is required.");
      }

      await loadStripeScript();
      const res = await api.post("/public/stripe/create-payment-intent", {
        programId,
        batchId,
        studentCount,
        sessionsPerWeek,
        selectedDays,
        selectedMonth,
        expectedUnitPrice,
        weeklyBatchIds,
        cartItems,
        checkoutMode,
        couponCode,
      });

      if (!res.data.success) throw new Error(res.data.message || "Could not start Stripe payment.");
      if (typeof res.data.amount === "number") onAmountConfirmed?.(res.data.amount);

      const publishableKey = res.data.publishableKey || STRIPE_PUBLISHABLE_KEY;
      const stripe = window.Stripe?.(publishableKey);
      if (!stripe) throw new Error("Stripe could not initialize.");

      const elements = stripe.elements({
        clientSecret: res.data.clientSecret,
        appearance: { theme: "stripe" },
      });
      const paymentElement = elements.create("payment");
      paymentElement.mount(`#${elementId.current}`);

      paidRef.current = false;
      paymentIntentRef.current = {
        paymentIntentId: res.data.paymentIntentId,
        clientSecret: res.data.clientSecret,
      };
      stripeRef.current = stripe;
      elementsRef.current = elements;
      paymentElementRef.current = paymentElement;
      setStarted(true);
      setReady(true);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load Stripe checkout."));
    } finally {
      setLoadingForm(false);
    }
  };

  const handlePay = async () => {
    if (!stripeRef.current || !elementsRef.current) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });

      if (result.error) throw new Error(result.error.message || "Stripe payment failed.");
      if (result.paymentIntent?.status !== "succeeded") {
        throw new Error("Stripe payment was not completed.");
      }

      paidRef.current = true;
      paymentIntentRef.current = null;
      await onSuccess(result.paymentIntent.id);
    } catch (err) {
      setError(getErrorMessage(err, "Stripe payment failed."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <p className="text-sm uppercase tracking-widest text-slate-500 mb-3">Stripe - Card Payment</p>
      {!started && (
        <button
          type="button"
          onClick={handleStartCardForm}
          disabled={disabled || loadingForm}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#635BFF] px-8 py-3 text-sm font-semibold text-white shadow-lg transition disabled:opacity-40"
        >
          {loadingForm ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Loading secure card form...
            </>
          ) : (
            "Continue to Card Details"
          )}
        </button>
      )}
      <div id={elementId.current} className={started ? "mt-4 min-h-[120px]" : "min-h-0"} />
      {error && <div className="mt-4 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">{error}</div>}
      {started && (
        <button
          type="button"
          onClick={handlePay}
          disabled={disabled || !ready || submitting}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#635BFF] px-8 py-3 text-sm font-semibold text-white shadow-lg transition disabled:opacity-40"
        >
          {submitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Processing...
            </>
          ) : (
            "Pay with Stripe"
          )}
        </button>
      )}
      <div className="mt-4 rounded-2xl bg-indigo-50 border border-indigo-200 p-4 text-sm text-indigo-700">
        Card details are handled securely by Stripe. CCA does not store card numbers.
      </div>
    </div>
  );
}
