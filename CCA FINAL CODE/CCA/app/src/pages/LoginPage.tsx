// ============================================================
//  LoginPage — ONE login screen for Parents, Coaches, and Admins.
//
//  Parents sign in with email + password (and can register here).
//  Coaches and Admins sign in with username + password — toggled
//  via the "Staff & Coach Sign In" link, since most visitors to
//  the homepage are parents and shouldn't have to pick a role
//  before they can even see a login form.
//
//  On successful login, each role is redirected to its own area:
//    parent -> /dashboard
//    coach  -> /coach
//    admin  -> /admin
// ============================================================
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useAdminAuth } from "../admin/context/AuthContext";
import { useCoachAuth } from "../coach/context/AuthContext";

type Mode = "parent-login" | "parent-register" | "staff";

function LoginPage() {
  const { login: parentLogin, register: parentRegister, loading: parentLoading } = useAuth();
  const { login: adminLogin } = useAdminAuth();
  const { login: coachLogin } = useCoachAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from;

  const [mode, setMode] = useState<Mode>("parent-login");
  const [error, setError] = useState("");
  const [staffSubmitting, setStaffSubmitting] = useState(false);

  // Parent login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Parent register state
  const [reg, setReg] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    password: "", confirmPassword: "", address: "", city: "", state: "", zip: "",
  });

  // Staff (coach/admin) login state
  const [staffUsername, setStaffUsername] = useState("");
  const [staffPassword, setStaffPassword] = useState("");

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await parentLogin(loginEmail, loginPassword);
      navigate(from || "/dashboard", { replace: true });
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
      navigate(from || "/dashboard", { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Registration failed.";
      setError(msg);
    }
  };

  // Tries Admin login first, then Coach login, so one form covers both
  // staff roles without asking the person to declare which they are.
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStaffSubmitting(true);
    try {
      try {
        await adminLogin(staffUsername, staffPassword);
        navigate(from || "/admin", { replace: true });
        return;
      } catch {
        // Not an admin account — fall through and try coach login.
      }
      await coachLogin(staffUsername, staffPassword);
      navigate(from || "/coach", { replace: true });
    } catch {
      setError("Invalid staff username or password.");
    } finally {
      setStaffSubmitting(false);
    }
  };

  const inputCls = "w-full rounded-2xl border border-[var(--pitch-deep)] bg-[var(--cream)] px-4 py-3 text-sm outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/20 transition";
  const labelCls = "block text-sm font-semibold text-[var(--outfield)] mb-1";

  return (
    <main className="min-h-screen relative flex items-center justify-center px-4 py-16 overflow-hidden" style={{ background: "var(--pitch)" }}>
      {/* Ambient pitch-stripe background — evokes a mown cricket
          outfield without competing with the form. */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
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

      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="text-center mb-8">
          <motion.div
            className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-[var(--pitch)] text-lg border-2 mx-auto"
            style={{ background: "var(--outfield)", borderColor: "var(--gold)" }}
            initial={{ scale: 0.8, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          >
            CCA
          </motion.div>
          <h1 className="font-display mt-4 text-[28px] font-semibold text-[var(--outfield)]">California Cricket Academy</h1>
          <div className="flex justify-center mt-2">
            <span className="scoreboard-label">
              {mode === "staff" ? "Coach & Admin Sign In" : "Parent Portal"}
            </span>
          </div>
        </div>

        {mode !== "staff" && (
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
        )}

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
              <div>
                <label className={labelCls}>Phone <span style={{ color: "var(--leather)" }}>*</span></label>
                <input type="tel" className={inputCls} value={reg.phone} onChange={(e) => setReg((p) => ({ ...p, phone: e.target.value }))} required placeholder="(555) 000-0000" />
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

          {mode === "staff" && (
            <form onSubmit={handleStaffLogin} className="space-y-4">
              <div>
                <label className={labelCls}>Username or ID</label>
                <input type="text" className={inputCls} value={staffUsername} onChange={(e) => setStaffUsername(e.target.value)} placeholder="coach.username or admin username" required autoFocus />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input type="password" className={inputCls} value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <button type="submit" disabled={staffSubmitting} className="w-full rounded-full py-3 font-semibold text-sm disabled:opacity-50 transition mt-2 hover:scale-[1.02] active:scale-[0.98]" style={{ background: "var(--outfield)", color: "var(--pitch)" }}>
                {staffSubmitting ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          <div className="text-center mt-6 pt-4" style={{ borderTop: "1px solid var(--pitch-soft)" }}>
            {mode === "staff" ? (
              <button type="button" onClick={() => { setMode("parent-login"); setError(""); }} className="text-xs font-semibold text-[var(--ink-500)] hover:text-[var(--outfield)] hover:underline">
                ← Back to Parent Sign In
              </button>
            ) : (
              <button type="button" onClick={() => { setMode("staff"); setError(""); }} className="text-xs font-semibold text-[var(--ink-500)] hover:text-[var(--outfield)] hover:underline">
                Coach or Admin? Sign in here
              </button>
            )}
          </div>
        </motion.div>

        <div className="seam-divider mt-8" />
      </motion.div>
    </main>
  );
}

export default LoginPage;
