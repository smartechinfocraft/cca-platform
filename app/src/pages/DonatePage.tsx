// ============================================================
//  pages/DonatePage.tsx — Standalone Donate Now page.
//  Content is paraphrased from publicly available facts about
//  California Cricket Academy's donation campaign (calcricket.org),
//  rewritten in our own words and laid out with this app's own
//  design system — not copied text or design from the source site.
//
//  PayPal integration: uses the PayPal JS SDK Buttons, backed by
//  two new backend endpoints (see backend/src/routes/public_registration.js):
//    POST /api/public/donate/create-order   { amount }
//    POST /api/public/donate/capture-order  { orderID, donor }
//  Amount is donor-chosen, validated server-side ($1–$100,000).
// ============================================================
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Sponsors from "../components/Sponsors";
import api from "../api/axios";
import type { PayPalButtonsInstance } from "../types/paypal";

// PayPal SDK types are declared globally in src/types/paypal.d.ts

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";

const presetAmounts = [25, 50, 100, 250];

const projectLineItems = [
  { label: "Santa Clara Facility Build", desc: "New central pitch, artificial mat, shade structure, and landscaping at a brand-new Santa Clara ground.", cost: 35000 },
  { label: "Dilworth Field Upgrade", desc: "Irrigation and reseeding work on the existing Dilworth school facility in San Jose / Cupertino.", cost: 30000 },
];

const fundUses = [
  { icon: "🥅", label: "Field Safety Nets", desc: "Maintaining safety netting at the Meriwest (Luther) field." },
  { icon: "🌱", label: "Dilworth Field Upgrades", desc: "Ongoing turf and irrigation improvements at the Dilworth ground." },
  { icon: "🏗️", label: "Batting Cage Upgrades", desc: "Keeping batting cages in top condition for daily training." },
  { icon: "🏟️", label: "Best Infrastructure in the Bay Area", desc: "Building toward the strongest cricket facilities of any academy in the region." },
];

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

function DonatePage() {
  const navigate = useNavigate();

  const [amount, setAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isCustom, setIsCustom] = useState(false);
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ amount: number; txnId?: string } | null>(null);

  const paypalRef = useRef<HTMLDivElement>(null);
  const paypalInstance = useRef<PayPalButtonsInstance | null>(null);

  const goal = projectLineItems.reduce((sum, l) => sum + l.cost, 0);
  const raisedSoFar = 18250; // placeholder progress — wire to a real backend total when available
  const progressPct = Math.min(100, Math.round((raisedSoFar / goal) * 100));

  const effectiveAmount = isCustom ? parseFloat(customAmount) || 0 : amount;

  // Load PayPal SDK once
  useEffect(() => {
    if (!PAYPAL_CLIENT_ID || window.paypal) return;
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  // (Re)render PayPal buttons whenever the chosen amount changes
  useEffect(() => {
    if (!paypalRef.current) return;
    if (!effectiveAmount || effectiveAmount < 1) {
      paypalRef.current.innerHTML = "";
      return;
    }

    let cancelled = false;

    const render = () => {
      if (cancelled) return;
      if (!window.paypal) { setTimeout(render, 400); return; }
      if (!paypalRef.current) return;

      paypalRef.current.innerHTML = "";
      paypalInstance.current = window.paypal.Buttons({
        style: { layout: "horizontal", color: "gold", shape: "pill", label: "donate", height: 48 },
        createOrder: async () => {
          setError(null);
          const res = await api.post("/public/donate/create-order", { amount: effectiveAmount });
          if (!res.data.success) throw new Error(res.data.message || "Could not start the donation.");
          return res.data.orderID;
        },
        onApprove: async (data: { orderID: string }) => {
          setLoading(true);
          setError(null);
          try {
            const capture = await api.post("/public/donate/capture-order", {
              orderID: data.orderID,
              donor: { name: donorName || undefined, email: donorEmail || undefined },
            });
            if (!capture.data.success) throw new Error(capture.data.message || "Payment capture failed.");
            setSuccess({ amount: capture.data.capturedAmount, txnId: capture.data.transactionId });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
          } finally {
            setLoading(false);
          }
        },
        onError: (err: unknown) => {
          console.error("PayPal donation error:", err);
          setError("PayPal encountered an error. Please try again.");
        },
        onCancel: () => { setError("Donation cancelled."); },
      });
      paypalInstance.current.render(paypalRef.current);
    };

    render();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveAmount]);

  return (
    <div className="overflow-x-hidden" style={{ background: "var(--pitch)" }}>
      <Navbar />
      <div className="h-20" /> {/* Spacer for fixed navbar */}
      {/* ───────────── HERO ───────────── */}
      <section className="relative pt-4 pb-20 overflow-hidden" style={{ background: "linear-gradient(145deg, #1F2E1E 0%, #2A3D27 55%, #1F2E1E 100%)" }}>
        <div className="hero-bg-canvas" aria-hidden="true">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />
          <div className="hero-dot-grid" />
        </div>
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <span className="scoreboard-label on-dark justify-center">Donate Now</span>
            <h1 className="font-display text-4xl sm:text-6xl font-semibold text-white leading-tight mt-5">
              Help Us Build the Next Cricket Ground
            </h1>
            <p className="text-white/70 text-lg mt-6 leading-8 max-w-2xl mx-auto">
              We're raising <strong className="text-white">${goal.toLocaleString()}</strong> for our school
              cricket initiative — a brand-new facility in Santa Clara and an upgrade to the existing Dilworth
              school ground in San Jose / Cupertino. Every donation goes directly toward the fields our players
              train and compete on.
            </p>
          </motion.div>

          {/* Progress bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-10 max-w-xl mx-auto"
          >
            <div className="flex justify-between text-sm text-white/70 mb-2">
              <span>${raisedSoFar.toLocaleString()} raised</span>
              <span>Goal: ${goal.toLocaleString()}</span>
            </div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1.1, ease: "easeOut", delay: 0.3 }}
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, var(--gold), var(--gold-light))" }}
              />
            </div>
            <p className="text-xs text-white/50 mt-2">{progressPct}% of the way to a new ground</p>
          </motion.div>
        </div>
      </section>

      {/* ───────────── DONATE CARD + PROJECT DETAILS ───────────── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-[1fr_1.1fr] gap-10">

          {/* Project breakdown */}
          <motion.div {...fadeUp} transition={{ duration: 0.45 }}>
            <span className="scoreboard-label">The Project</span>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--outfield)] mt-4">
              Where Your Donation Goes
            </h2>
            <p className="text-[var(--ink-500)] mt-4 leading-7">
              We need your generous support for our new school cricket initiative — building a new ground
              in Santa Clara and upgrading the Dilworth school facility our players already train on.
            </p>

            <div className="mt-7 space-y-4">
              {projectLineItems.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -14 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="flex items-start gap-4 p-5 rounded-2xl bg-white border"
                  style={{ borderColor: "var(--pitch-deep)" }}
                >
                  <span
                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-display font-semibold text-sm"
                    style={{ background: "var(--gold-glow)", color: "var(--outfield)" }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <h3 className="font-display font-semibold text-[var(--outfield)] text-base">{item.label}</h3>
                      <span className="text-sm font-semibold" style={{ color: "var(--leather)" }}>${item.cost.toLocaleString()}</span>
                    </div>
                    <p className="text-[var(--ink-500)] text-sm mt-1.5 leading-6">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="seam-divider mt-8 mb-8" />

            <span className="scoreboard-label">What Ongoing Gifts Support</span>
            <div className="grid sm:grid-cols-2 gap-4 mt-5">
              {fundUses.map((f, i) => (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.07 }}
                  className="why-card !p-5"
                >
                  <span className="text-2xl">{f.icon}</span>
                  <h4 className="font-display font-semibold text-[var(--outfield)] text-sm mt-3">{f.label}</h4>
                  <p className="text-[var(--ink-500)] text-xs mt-1.5 leading-5">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Donate widget */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl p-7 sm:p-9 bg-white border h-fit lg:sticky lg:top-24"
            style={{ borderColor: "var(--pitch-deep)", boxShadow: "var(--shadow-lift)" }}
          >
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-6"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                    className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-3xl"
                    style={{ background: "var(--grass-glow)" }}
                  >
                    🏏
                  </motion.div>
                  <h3 className="font-display text-2xl font-semibold text-[var(--outfield)] mt-5">
                    Thank You!
                  </h3>
                  <p className="text-[var(--ink-500)] mt-3 leading-7">
                    Your donation of <strong>${success.amount?.toFixed(2)}</strong> was received. It goes
                    straight toward giving CCA players a better ground to play on.
                  </p>
                  {success.txnId && (
                    <p className="text-xs text-[var(--ink-400)] mt-3">Transaction ID: {success.txnId}</p>
                  )}
                  <button
                    onClick={() => navigate("/")}
                    className="mt-7 inline-flex items-center gap-2 rounded-full px-7 py-3 font-semibold text-sm"
                    style={{ background: "var(--gold)", color: "var(--outfield)" }}
                  >
                    Back to Home
                  </button>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <span className="scoreboard-label">Choose an Amount</span>
                  <h3 className="font-display text-2xl font-semibold text-[var(--outfield)] mt-3">
                    Support the Build
                  </h3>

                  <div className="grid grid-cols-4 gap-2.5 mt-6">
                    {presetAmounts.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => { setAmount(amt); setIsCustom(false); }}
                        className="rounded-xl py-3 text-sm font-semibold border-2 transition-all"
                        style={
                          !isCustom && amount === amt
                            ? { borderColor: "var(--gold)", background: "var(--gold-glow)", color: "var(--outfield)" }
                            : { borderColor: "var(--pitch-deep)", color: "var(--ink-500)" }
                        }
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setIsCustom(true)}
                      className="w-full rounded-xl py-3 text-sm font-semibold border-2 transition-all flex items-center justify-center gap-2"
                      style={
                        isCustom
                          ? { borderColor: "var(--gold)", background: "var(--gold-glow)", color: "var(--outfield)" }
                          : { borderColor: "var(--pitch-deep)", color: "var(--ink-500)" }
                      }
                    >
                      <span>$</span>
                      <input
                        type="number"
                        min={1}
                        max={100000}
                        placeholder="Custom amount"
                        value={customAmount}
                        onFocus={() => setIsCustom(true)}
                        onChange={(e) => { setCustomAmount(e.target.value); setIsCustom(true); }}
                        className="bg-transparent outline-none text-center w-32"
                      />
                    </button>
                  </div>

                  <div className="mt-6 space-y-3">
                    <input
                      type="text"
                      placeholder="Your name (optional)"
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[var(--gold)] transition-colors"
                      style={{ borderColor: "var(--pitch-deep)" }}
                    />
                    <input
                      type="email"
                      placeholder="Email for receipt (optional)"
                      value={donorEmail}
                      onChange={(e) => setDonorEmail(e.target.value)}
                      className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[var(--gold)] transition-colors"
                      style={{ borderColor: "var(--pitch-deep)" }}
                    />
                  </div>

                  <div className="mt-6 rounded-2xl p-4 flex items-center justify-between" style={{ background: "var(--pitch-soft)" }}>
                    <span className="text-sm text-[var(--ink-500)]">Donating</span>
                    <span className="font-display text-2xl font-semibold text-[var(--outfield)]">
                      ${effectiveAmount > 0 ? effectiveAmount.toFixed(2) : "0.00"}
                    </span>
                  </div>

                  <div className="mt-6">
                    {PAYPAL_CLIENT_ID ? (
                      <>
                        <div ref={paypalRef} className="min-h-[52px]" />
                        {effectiveAmount < 1 && (
                          <p className="text-xs text-center text-[var(--ink-400)] mt-2">Choose or enter an amount to continue.</p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-center text-[var(--leather)] bg-[var(--leather-glow)] rounded-xl p-3">
                        PayPal isn't configured yet — set VITE_PAYPAL_CLIENT_ID in the app's .env file.
                      </p>
                    )}

                    {loading && (
                      <p className="text-sm text-center text-[var(--ink-500)] mt-3 flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
                        Processing your donation...
                      </p>
                    )}
                    {error && (
                      <p className="text-sm text-center mt-3 rounded-xl p-3" style={{ background: "var(--leather-glow)", color: "var(--leather)" }}>
                        {error}
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-center text-[var(--ink-400)] mt-5 flex items-center justify-center gap-1.5">
                    🔒 Secure checkout via PayPal — CCA never sees or stores your card details.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* ───────────── 501(c)(3) STRIP ───────────── */}
      <section className="py-10" style={{ background: "var(--outfield)" }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-white/70 text-sm leading-7">
            California Cricket Academy is a federally recognized 501(c)(3) nonprofit and the first cricket
            academy and youth league built for children ages 6 to 17 in the United States. Your donation
            directly supports the next generation of cricketers in the Bay Area.
          </p>
        </div>
      </section>

      {/* ───────────── SPONSORS ───────────── */}
      <Sponsors />

      {/* ───────────── CLOSING CTA ───────────── */}
      <section className="py-20" style={{ background: "var(--pitch-soft)" }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div {...fadeUp} transition={{ duration: 0.45 }}>
            <span className="scoreboard-label justify-center">Any Questions?</span>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--outfield)] mt-4">
              We're Happy to Talk
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <button
                onClick={() => navigate("/faq")}
                className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 font-semibold text-sm border-2 hover:bg-white transition-colors"
                style={{ borderColor: "var(--outfield)", color: "var(--outfield)" }}
              >
                Check Out FAQs
              </button>
              <button
                onClick={() => navigate("/about")}
                className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 font-semibold text-sm shadow-lg hover:scale-105 transition-transform"
                style={{ background: "var(--gold)", color: "var(--outfield)" }}
              >
                Learn More About CCA →
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default DonatePage;
