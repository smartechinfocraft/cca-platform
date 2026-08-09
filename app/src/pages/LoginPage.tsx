// ============================================================
//  Parent portal login and registration.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

type Mode = "parent-login" | "parent-register";

function LoginPage({ modal = false }: { modal?: boolean }) {
  const modalRef = useRef<HTMLElement>(null);
  const { login: parentLogin, register: parentRegister, loading: parentLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as {
    from?: string;
    mode?: Mode;
    prefill?: { firstName?: string; lastName?: string; email?: string; phone?: string; city?: string };
  } | null;
  const from = navState?.from;

  const closeModal = () => navigate(-1);

  useEffect(() => {
    if (!modal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(modalRef.current?.querySelectorAll<HTMLElement>(focusableSelector) || []);
    focusable[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
        return;
      }
      if (event.key !== "Tab") return;
      const currentFocusable = Array.from(modalRef.current?.querySelectorAll<HTMLElement>(focusableSelector) || []);
      if (!currentFocusable.length) return;
      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [modal]);

  const [mode, setMode] = useState<Mode>(navState?.mode === "parent-register" ? "parent-register" : "parent-login");
  const [error, setError] = useState("");

  // Parent login state
  const [loginEmail, setLoginEmail] = useState(navState?.prefill?.email || "");
  const [loginPassword, setLoginPassword] = useState("");

  // Parent register state
  const [reg, setReg] = useState({
    firstName: navState?.prefill?.firstName || "",
    lastName: navState?.prefill?.lastName || "",
    email: navState?.prefill?.email || "",
    phone: navState?.prefill?.phone || "",
    password: "", confirmPassword: "",
    address: "",
    city: navState?.prefill?.city || "",
    state: "", zip: "",
  });

  // ── Forgot Password state ────────────────────────────────────
  const [showForgot, setShowForgot]      = useState(false);
  const [forgotEmail, setForgotEmail]    = useState("");
  const [forgotLoading, setForgotLoad]   = useState(false);
  const [forgotSent, setForgotSent]      = useState(false);

  const openForgot = () => {
    setForgotEmail("");
    setForgotSent(false);
    setShowForgot(true);
  };

  const closeForgot = () => {
    setShowForgot(false);
    setForgotEmail("");
    setForgotSent(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoad(true);
    try {
      await axios.post(`${API_BASE}/public/auth/forgot-password`, { email: forgotEmail });
    } catch {
      // Silent — always show success
    } finally {
      setForgotLoad(false);
      setForgotSent(true);
    }
  };

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await parentLogin(loginEmail, loginPassword);
      toast.success("Signed in successfully!");
      navigate(from || "/", { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Login failed.";
      setError(msg);
    }
  };

  const handleParentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (reg.password !== reg.confirmPassword) { setError("Passwords do not match."); return; }
    if (reg.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    try {
      await parentRegister({ ...reg });
      toast.success("Registration successful!");
      navigate(from || "/", { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Registration failed.";
      setError(msg);
    }
  };

  const inputCls = "w-full rounded-2xl border border-[var(--pitch-deep)] bg-[var(--cream)] px-4 py-3 text-sm outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/20 transition";
  const labelCls = "block text-sm font-semibold text-[var(--outfield)] mb-1";

  return (
    <main
      ref={modalRef}
      className={`${modal ? "fixed inset-0 z-[10000] overflow-y-auto bg-white/85 backdrop-blur-md" : "relative min-h-screen overflow-hidden"} flex items-center justify-center px-4 py-16`}
      style={modal ? undefined : { background: "var(--pitch)" }}
      role={modal ? "dialog" : undefined}
      aria-modal={modal || undefined}
      aria-label={modal ? "Parent sign in or registration" : undefined}
      onMouseDown={modal ? closeModal : undefined}
    >
      <div className={`${modal ? "hidden" : ""} absolute inset-0 pointer-events-none`} aria-hidden="true">
        <div className="absolute inset-0" style={{
          background: "repeating-linear-gradient(115deg, rgba(63,125,79,0.05) 0px, rgba(63,125,79,0.05) 80px, transparent 80px, transparent 160px)",
        }} />
        <motion.div
          className="absolute -top-40 -right-32 w-[480px] h-[480px] rounded-full"
          style={{ background: "radial-gradient(circle, var(--gold-glow) 0%, transparent 70%)" }}
          animate={{ y: [0, -24, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-32 -left-24 w-[360px] h-[360px] rounded-full"
          style={{ background: "radial-gradient(circle, var(--grass-glow) 0%, transparent 70%)" }}
          animate={{ y: [0, 20, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
      </div>

      {modal && (
        <button
          type="button"
          onClick={closeModal}
          className="fixed right-5 top-5 z-[10001] flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-bold text-[var(--outfield)] shadow-lg ring-1 ring-black/10 transition hover:scale-105 hover:bg-slate-50"
          aria-label="Close parent login"
        >
          ×
        </button>
      )}

      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex mx-auto mb-4">
            <img src="/logo.svg" alt="CCA Logo" className="h-12 w-auto" />
          </Link>
          {/* <motion.div
            className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-[var(--pitch)] text-lg border-2 mx-auto"
            style={{ background: "var(--outfield)", borderColor: "var(--gold)" }}
            initial={{ scale: 0.8, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          >
            CCA
          </motion.div>

          <h1 className="font-display mt-4 text-[28px] font-semibold text-[var(--outfield)]">California Cricket Academy</h1>
         */}
         <div className="flex justify-center mt-2">
            <span className="scoreboard-label">Parent Portal</span>
          </div>
        </div>

        <div className="flex rounded-2xl p-1 mb-6" style={{ background: "var(--pitch-soft)" }}>
            {(["parent-login", "parent-register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setMode(t); setError(""); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                  mode === t ? "bg-white text-[var(--outfield)] shadow-sm" : "text-[var(--ink-500)] hover:text-[var(--outfield)]"
                }`}
              >
                {t === "parent-login" ? "Sign In" : "Create Account"}
              </button>
            ))}
        </div>

        <motion.div
          className="bg-white rounded-[28px] shadow-xl p-8"
          style={{ boxShadow: "var(--shadow-lift)", border: "1px solid var(--pitch-deep)" }}
          layout
        >
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-3 text-sm text-red-600 overflow-hidden"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {mode === "parent-login" && (
            <form onSubmit={handleParentLogin} className="space-y-4">
              <div>
                <label className={labelCls}>Email Address</label>
                <input type="email" className={inputCls} value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="parent@email.com" required />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input type="password" className={inputCls} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              {/* Forgot password link */}
              <div className="text-right -mt-2">
                <button
                  type="button"
                  onClick={openForgot}
                  className="text-sm font-semibold hover:underline"
                  style={{ color: "var(--grass)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>
              <button type="submit" disabled={parentLoading} className="w-full rounded-full py-3 font-semibold text-sm disabled:opacity-50 transition mt-2 hover:scale-[1.02] active:scale-[0.98]" style={{ background: "var(--gold)", color: "var(--outfield)" }}>
                {parentLoading ? "Signing in..." : "Sign In"}
              </button>
              <p className="text-center text-sm text-[var(--ink-500)] mt-3">
                Don't have an account?{" "}
                <button type="button" onClick={() => setMode("parent-register")} className="font-semibold hover:underline" style={{ color: "var(--grass)" }}>
                  Create one
                </button>
              </p>
            </form>
          )}

          {mode === "parent-register" && (
            <form onSubmit={handleParentRegister} className="space-y-4">
              {navState?.prefill && (
                <div
                  className="rounded-xl px-4 py-2.5 text-xs flex items-center gap-2"
                  style={{ background: "var(--gold-glow)", color: "var(--outfield)" }}
                >
                  ✨ Nice — CCA already filled in what you told the chatbot. Just set a password to finish.
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First Name <span style={{ color: "var(--leather)" }}>*</span></label>
                  <input type="text" className={inputCls} value={reg.firstName} onChange={(e) => setReg((p) => ({ ...p, firstName: e.target.value }))} required placeholder="John" />
                </div>
                <div>
                  <label className={labelCls}>Last Name <span style={{ color: "var(--leather)" }}>*</span></label>
                  <input type="text" className={inputCls} value={reg.lastName} onChange={(e) => setReg((p) => ({ ...p, lastName: e.target.value }))} required placeholder="Doe" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Email <span style={{ color: "var(--leather)" }}>*</span></label>
                <input type="email" className={inputCls} value={reg.email} onChange={(e) => setReg((p) => ({ ...p, email: e.target.value }))} required placeholder="parent@email.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Password <span style={{ color: "var(--leather)" }}>*</span></label>
                  <input type="password" className={inputCls} value={reg.password} onChange={(e) => setReg((p) => ({ ...p, password: e.target.value }))} required placeholder="Min 6 chars" />
                </div>
                <div>
                  <label className={labelCls}>Confirm Password <span style={{ color: "var(--leather)" }}>*</span></label>
                  <input type="password" className={inputCls} value={reg.confirmPassword} onChange={(e) => setReg((p) => ({ ...p, confirmPassword: e.target.value }))} required placeholder="Repeat" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Phone <span style={{ color: "var(--leather)" }}>*</span></label>
                <input type="tel" className={inputCls} value={reg.phone} onChange={(e) => setReg((p) => ({ ...p, phone: e.target.value }))} required placeholder="(555) 000-0000" />
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <input type="text" className={inputCls} value={reg.address} onChange={(e) => setReg((p) => ({ ...p, address: e.target.value }))} placeholder="123 Main St" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className={labelCls}>City</label>
                  <input type="text" className={inputCls} value={reg.city} onChange={(e) => setReg((p) => ({ ...p, city: e.target.value }))} placeholder="City" />
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <input type="text" className={inputCls} value={reg.state} onChange={(e) => setReg((p) => ({ ...p, state: e.target.value }))} placeholder="CA" maxLength={2} />
                </div>
                <div>
                  <label className={labelCls}>ZIP</label>
                  <input type="text" className={inputCls} value={reg.zip} onChange={(e) => setReg((p) => ({ ...p, zip: e.target.value }))} placeholder="90001" />
                </div>
              </div>
              <button type="submit" disabled={parentLoading} className="w-full rounded-full py-3 font-semibold text-sm disabled:opacity-50 transition mt-2 hover:scale-[1.02] active:scale-[0.98]" style={{ background: "var(--gold)", color: "var(--outfield)" }}>
                {parentLoading ? "Creating Account..." : "Create Account"}
              </button>
              <p className="text-center text-sm text-[var(--ink-500)] mt-3">
                Already have an account?{" "}
                <button type="button" onClick={() => setMode("parent-login")} className="font-semibold hover:underline" style={{ color: "var(--grass)" }}>
                  Sign in
                </button>
              </p>
            </form>
          )}

        </motion.div>

        {!modal && (
          <Link
            to="/"
            className="mt-6 flex w-full items-center justify-center rounded-full border-2 border-[var(--outfield)] px-5 py-3 text-sm font-bold text-[var(--outfield)] transition hover:bg-[var(--outfield)] hover:text-white"
          >
            ← Back to CCA Website
          </Link>
        )}

        <div className="seam-divider mt-8" />
      </motion.div>

      {/* ── Forgot Password Modal ── */}
      <AnimatePresence>
        {showForgot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 200, padding: "24px",
            }}
            onClick={closeForgot}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 16 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="bg-white rounded-[28px] p-8 w-full"
              style={{ maxWidth: "400px", position: "relative", boxShadow: "0 40px 100px rgba(0,0,0,0.35)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeForgot}
                style={{
                  position: "absolute", top: "16px", right: "18px",
                  background: "none", border: "none", fontSize: "20px",
                  cursor: "pointer", color: "#94a3b8",
                }}
              >✕</button>

              {forgotSent ? (
                <div className="text-center">
                  <div style={{ fontSize: "44px", marginBottom: "12px" }}>✉️</div>
                  <h2 className="text-xl font-bold mb-2" style={{ color: "var(--outfield)" }}>Check Your Email</h2>
                  <p className="text-sm mb-6" style={{ color: "var(--ink-500)", lineHeight: "1.6" }}>
                    If <strong>{forgotEmail}</strong> is registered in our system, you'll receive a temporary password shortly.
                    Use it to log in, then update your password.
                  </p>
                  <button
                    type="button"
                    onClick={closeForgot}
                    className="w-full rounded-full py-3 font-semibold text-sm hover:scale-[1.02] transition"
                    style={{ background: "var(--gold)", color: "var(--outfield)" }}
                  >
                    Back to Login
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: "40px", textAlign: "center", marginBottom: "8px" }}>🔑</div>
                  <h2 className="text-xl font-bold text-center mb-2" style={{ color: "var(--outfield)" }}>
                    Reset Password
                  </h2>
                  <p className="text-sm text-center mb-6" style={{ color: "var(--ink-500)", lineHeight: "1.5" }}>
                    Enter your registered email address and we'll send a temporary password.
                  </p>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className={labelCls}>Registered Email</label>
                      <input
                        type="email"
                        className={inputCls}
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full rounded-full py-3 font-semibold text-sm disabled:opacity-50 hover:scale-[1.02] transition"
                      style={{ background: "var(--outfield)", color: "var(--pitch)" }}
                    >
                      {forgotLoading ? "Sending..." : "Send Temporary Password"}
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

export default LoginPage;
