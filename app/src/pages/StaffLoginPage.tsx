import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAdminAuth } from "../admin/context/AuthContext";
import { useCoachAuth } from "../coach/context/AuthContext";

function StaffLoginPage() {
  const { login: adminLogin } = useAdminAuth();
  const { login: coachLogin } = useCoachAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      try {
        await adminLogin(username, password);
        navigate(from?.startsWith("/admin") ? from : "/admin", { replace: true });
        return;
      } catch {
        // The same staff identifier can be checked against the coach portal next.
      }
      await coachLogin(username, password);
      navigate(from?.startsWith("/coach") ? from : "/coach", { replace: true });
    } catch {
      setError("Invalid staff username or password.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-2xl border border-[var(--pitch-deep)] bg-[var(--cream)] px-4 py-3 text-sm outline-none transition focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/20";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16" style={{ background: "var(--pitch)" }}>
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ background: "repeating-linear-gradient(115deg, rgba(63,125,79,0.05) 0px, rgba(63,125,79,0.05) 80px, transparent 80px, transparent 160px)" }} />
      <motion.div className="relative z-10 w-full max-w-md" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8 text-center">
          <Link to="/" className="mb-4 inline-flex"><img src="/logo.svg" alt="CCA Logo" className="h-12 w-auto" /></Link>
          <div><span className="scoreboard-label">Coach &amp; Admin Portal</span></div>
        </div>
        <div className="rounded-[28px] border border-[var(--pitch-deep)] bg-white p-8 shadow-xl" style={{ boxShadow: "var(--shadow-lift)" }}>
          <h1 className="mb-1 text-center text-2xl font-semibold text-[var(--outfield)]">Staff sign in</h1>
          <p className="mb-6 text-center text-sm text-[var(--ink-500)]">For authorized coaches and administrators.</p>
          {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-[var(--outfield)]">Username or ID</label>
              <input className={inputClass} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Staff username" autoComplete="username" required autoFocus />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-[var(--outfield)]">Password</label>
              <input type="password" className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" required />
            </div>
            <button type="submit" disabled={submitting} className="mt-2 w-full rounded-full py-3 text-sm font-semibold transition hover:scale-[1.02] disabled:opacity-50" style={{ background: "var(--outfield)", color: "var(--pitch)" }}>
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </motion.div>
    </main>
  );
}

export default StaffLoginPage;
