// ============================================================
//  pages/dashboard/DashboardHome.tsx
//  Overview screen: stats, recent programs/registrations,
//  students snapshot, and recent attendance — the first thing
//  a parent sees right after logging in.
// ============================================================
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  HiOutlineAcademicCap,
  HiOutlineCurrencyDollar,
  HiOutlineUserGroup,
  HiOutlineClock,
  HiOutlineArrowRight,
  HiOutlineCalendarDays,
} from "react-icons/hi2";
import { useAuth } from "../../context/AuthContext";
import { getParentDashboard } from "../../services/parentDashboardService";
import type { DashboardData } from "../../types/parentDashboard";
import StatusBadge from "../../components/dashboard/StatusBadge";

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function StatCard({
  icon: Icon, label, value, accent,
}: { icon: React.ElementType; label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-[var(--outfield)]">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function DashboardHome() {
  const { user, token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getParentDashboard(token)
      .then(setData)
      .catch(() => setError("Couldn't load your dashboard right now. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--outfield)]">
          Welcome back, {user?.firstName} 👋
        </h1>
        <p className="text-slate-500 mt-1">Here's what's happening with your child's training.</p>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : data ? (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={HiOutlineAcademicCap}
              label="Active Programs"
              value={data.stats.activePrograms}
              accent="bg-amber-100 text-[var(--gold)]"
            />
            <StatCard
              icon={HiOutlineUserGroup}
              label="Students"
              value={data.stats.totalStudents}
              accent="bg-blue-100 text-blue-600"
            />
            <StatCard
              icon={HiOutlineCurrencyDollar}
              label="Total Spent"
              value={`$${data.stats.totalSpent.toFixed(0)}`}
              accent="bg-green-100 text-green-600"
            />
            <StatCard
              icon={HiOutlineClock}
              label="Pending Payments"
              value={data.stats.pendingPayments}
              accent="bg-amber-100 text-amber-600"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Recent programs / registrations */}
            <div className="lg:col-span-2 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-[var(--outfield)]">Current &amp; Recent Programs</h2>
                <Link to="/dashboard/purchases" className="text-sm font-semibold text-[var(--gold)] hover:underline flex items-center gap-1">
                  View all <HiOutlineArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {data.recentRegistrations.length === 0 ? (
                <EmptyState
                  title="No programs yet"
                  body="Once you register your child for a program, it will show up here."
                  ctaLabel="Browse Programs"
                  ctaTo="/programs"
                />
              ) : (
                <div className="space-y-3">
                  {data.recentRegistrations.map((reg) => (
                    <div key={reg._id} className="flex items-center gap-4 rounded-2xl border border-slate-100 p-4 hover:border-slate-200 transition">
                      <div className="w-12 h-12 rounded-xl bg-[#FEF4E6] flex items-center justify-center flex-shrink-0">
                        <HiOutlineAcademicCap className="h-6 w-6 text-[var(--gold)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[var(--outfield)] truncate">{reg.programId?.title || "CCA Program"}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {reg.registrationNumber} • {reg.students?.map(s => s.firstName).join(", ") || "—"}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <StatusBadge status={reg.status} />
                        <p className="text-xs text-slate-400 mt-1">{formatDate(reg.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Students snapshot */}
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-[var(--outfield)]">My Students</h2>
                <Link to="/dashboard/students" className="text-sm font-semibold text-[var(--gold)] hover:underline">
                  Manage
                </Link>
              </div>

              {data.students.length === 0 ? (
                <p className="text-sm text-slate-500">No students added yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.students.slice(0, 4).map((s) => (
                    <Link
                      key={s._id}
                      to={`/dashboard/students/${s._id}`}
                      className="flex items-center gap-3 rounded-2xl p-2 hover:bg-slate-50 transition"
                    >
                      {s.photoUrl ? (
                        <img src={s.photoUrl} alt={s.firstName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[var(--outfield)] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {s.firstName[0]}{s.lastName[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--outfield)] truncate">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-slate-400">{s.studentCode}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent attendance */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[var(--outfield)]">Recent Attendance</h2>
              <Link to="/dashboard/students" className="text-sm font-semibold text-[var(--gold)] hover:underline flex items-center gap-1">
                View by student <HiOutlineArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {data.recentAttendance.length === 0 ? (
              <EmptyState
                title="No attendance recorded yet"
                body="Attendance will appear here once your child's coach marks their first session."
              />
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Student</th>
                      <th className="px-2 py-2">Program</th>
                      <th className="px-2 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentAttendance.map((a) => (
                      <tr key={a._id} className="border-t border-slate-100">
                        <td className="px-2 py-3 text-slate-500 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <HiOutlineCalendarDays className="h-4 w-4 text-slate-400" />
                            {formatDate(a.date)}
                          </span>
                        </td>
                        <td className="px-2 py-3 font-medium text-[var(--outfield)]">
                          {typeof a.studentId === "object" ? `${a.studentId.firstName} ${a.studentId.lastName}` : "—"}
                        </td>
                        <td className="px-2 py-3 text-slate-500">{a.programId?.title || "—"}</td>
                        <td className="px-2 py-3 text-right"><StatusBadge status={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function EmptyState({
  title, body, ctaLabel, ctaTo,
}: { title: string; body: string; ctaLabel?: string; ctaTo?: string }) {
  return (
    <div className="text-center py-10">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <HiOutlineAcademicCap className="h-6 w-6 text-slate-400" />
      </div>
      <p className="font-semibold text-[var(--outfield)]">{title}</p>
      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{body}</p>
      {ctaLabel && ctaTo && (
        <Link
          to={ctaTo}
          className="inline-flex items-center gap-2 mt-4 rounded-full bg-[var(--gold)] text-[var(--outfield)] px-5 py-2.5 text-sm font-semibold hover:bg-[var(--gold-light)] transition"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-3xl bg-white p-6 ring-1 ring-slate-200/60 h-32" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl bg-white p-6 ring-1 ring-slate-200/60 h-64" />
        <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200/60 h-64" />
      </div>
    </div>
  );
}

export default DashboardHome;
