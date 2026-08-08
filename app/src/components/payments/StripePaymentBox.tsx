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
  prepareRegistration: () => Promise<{ registrationId: string }>;
  onSuccess: (registration: any) => Promise<void> | void;
  startPayment?: (registrationId: string) => Promise<any>;
  finalizePayment?: (registrationId: string, paymentIntentId: string) => Promise<any>;
  pendingStorageKey?: string;
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
  prepareRegistration,
  onSuccess,
  startPayment,
  finalizePayment,
  pendingStorageKey = "cca:pendingStripeRegistration",
}: StripePaymentBoxProps) {
  const elementId = useRef(`stripe-payment-${Math.random().toString(36).slice(2)}`);
  const paymentElementRef = useRef<StripePaymentElement | null>(null);
  const stripeRef = useRef<StripeClient | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const paymentIntentRef = useRef<{ paymentIntentId: string; clientSecret: string } | null>(null);
  const paidRef = useRef(false);
  const recoveryStartedRef = useRef(false);

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
      resetStripeForm();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, batchId, studentCount, sessionsPerWeek, selectedDays, selectedMonth, expectedUnitPrice, weeklyBatchIds, cartItems, checkoutMode, couponCode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedIntentId = params.get("payment_intent");
    const returnedStatus = params.get("redirect_status");
    const pending = JSON.parse(sessionStorage.getItem(pendingStorageKey) || "{}");
    if (!returnedIntentId || returnedStatus !== "succeeded" || !pending.registrationId) return;
    if (recoveryStartedRef.current) return;
    recoveryStartedRef.current = true;

    setSubmitting(true);
    const finalize = finalizePayment
      ? finalizePayment(pending.registrationId, returnedIntentId)
      : api.post("/public/stripe/finalize-registration", { registrationId: pending.registrationId, paymentIntentId: returnedIntentId }).then(r => r.data);
    finalize.then(async (data) => {
      sessionStorage.removeItem(pendingStorageKey);
      const cleanUrl = `${window.location.pathname}${window.location.hash}`;
      window.history.replaceState({}, document.title, cleanUrl);
      await onSuccess(data);
    }).catch((err) => {
      recoveryStartedRef.current = false;
      setError(getErrorMessage(err, "Could not finalize Stripe payment."));
    }).finally(() => setSubmitting(false));
  }, [finalizePayment, onSuccess, pendingStorageKey]);

  const handleStartCardForm = async () => {
    setError(null);
    setLoadingForm(true);
    try {
      if ((!programId && (!cartItems || cartItems.length === 0)) || !STRIPE_PUBLISHABLE_KEY) {
        throw new Error(!STRIPE_PUBLISHABLE_KEY ? "Stripe is not configured yet." : "Program is required.");
      }

      await loadStripeScript();
      const prepared = await prepareRegistration();
      if (!prepared?.registrationId) throw new Error("Could not create the pending registration.");
      const responseData = startPayment
        ? await startPayment(prepared.registrationId)
        : (await api.post("/public/stripe/create-payment-intent", { registrationId: prepared.registrationId })).data;

      if (!responseData.success) throw new Error(responseData.message || "Could not start Stripe payment.");
      if (responseData.alreadyCompleted) { await onSuccess(responseData); return; }
      if (typeof responseData.amount === "number") onAmountConfirmed?.(responseData.amount);

      const publishableKey = responseData.publishableKey || STRIPE_PUBLISHABLE_KEY;
      const stripe = window.Stripe?.(publishableKey);
      if (!stripe) throw new Error("Stripe could not initialize.");

      const elements = stripe.elements({
        clientSecret: responseData.clientSecret,
        appearance: { theme: "stripe" },
      });
      const paymentElement = elements.create("payment");
      paymentElement.mount(`#${elementId.current}`);

      paidRef.current = false;
      paymentIntentRef.current = {
        paymentIntentId: responseData.paymentIntentId,
        clientSecret: responseData.clientSecret,
      };
      sessionStorage.setItem(pendingStorageKey, JSON.stringify({
        registrationId: prepared.registrationId,
        paymentIntentId: responseData.paymentIntentId,
      }));
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
      const pending = JSON.parse(sessionStorage.getItem(pendingStorageKey) || "{}");
      const finalized = finalizePayment
        ? await finalizePayment(pending.registrationId, result.paymentIntent.id)
        : (await api.post("/public/stripe/finalize-registration", { registrationId: pending.registrationId, paymentIntentId: result.paymentIntent.id })).data;
      sessionStorage.removeItem(pendingStorageKey);
      await onSuccess(finalized);
    } catch (err) {
      const pendingIntent = paymentIntentRef.current;
      const pendingRegistration = JSON.parse(sessionStorage.getItem(pendingStorageKey) || "{}");
      if (pendingIntent && pendingRegistration.registrationId) {
        api.post("/public/stripe/report-payment-failure", {
          registrationId: pendingRegistration.registrationId,
          paymentIntentId: pendingIntent.paymentIntentId,
          clientSecret: pendingIntent.clientSecret,
          reason: getErrorMessage(err, "Card payment was not completed."),
        }).catch(() => undefined);
      }
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
