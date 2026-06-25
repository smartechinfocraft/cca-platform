// ============================================================
//  pages/dashboard/MyStudents.tsx
//  List of all children registered under this parent, each
//  showing a quick attendance summary and active programs.
//  Clicking a card opens the full Student Detail page.
// ============================================================
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  HiOutlineUserGroup,
  HiOutlineChevronRight,
  HiOutlineCalendarDays,
} from "react-icons/hi2";
import { useAuth } from "../../context/AuthContext";
import { getMyStudents } from "../../services/parentDashboardService";
import type { StudentWithSummary } from "../../types/parentDashboard";

function MyStudents() {
  const { token } = useAuth();
  const [students, setStudents] = useState<StudentWithSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getMyStudents(token)
      .then(setStudents)
      .catch(() => setError("Couldn't load your students. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">My Students</h1>
        <p className="text-slate-500 mt-1">View attendance and download ID cards for each child.</p>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4 animate-pulse">
          {[0, 1].map(i => <div key={i} className="h-44 rounded-3xl bg-white ring-1 ring-slate-200/60" />)}
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200/60">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <HiOutlineUserGroup className="h-6 w-6 text-slate-400" />
          </div>
          <p className="font-semibold text-[#0F172A]">No students yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Children you register for a program will appear here automatically.
          </p>
          <Link
            to="/programs"
            className="inline-flex items-center gap-2 mt-4 rounded-full bg-[#F97316] text-white px-5 py-2.5 text-sm font-semibold hover:bg-orange-600 transition"
          >
            Browse Programs
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {students.map((s) => (
            <Link
              key={s._id}
              to={`/dashboard/students/${s._id}`}
              className="rounded-3xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-slate-200/60 hover:ring-[#F97316]/40 hover:shadow-md transition group"
            >
              <div className="flex items-start gap-4">
                {s.photoUrl ? (
                  <img src={s.photoUrl} alt={s.firstName} className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                    {s.firstName[0]}{s.lastName[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-[#0F172A] truncate">{s.firstName} {s.lastName}</p>
                    <HiOutlineChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#F97316] transition flex-shrink-0" />
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{s.studentCode}</p>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {s.programs.slice(0, 2).map((p) => (
                      <span key={p.registrationId} className="text-xs bg-[#FEF4E6] text-[#0F172A] px-2.5 py-1 rounded-full font-medium truncate max-w-[140px]">
                        {p.programTitle || "Program"}
                      </span>
                    ))}
                    {s.programs.length > 2 && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-medium">
                        +{s.programs.length - 2} more
                      </span>
                    )}
                    {s.programs.length === 0 && (
                      <span className="text-xs text-slate-400">No active programs</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <HiOutlineCalendarDays className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-500">Attendance</span>
                </div>
                {s.attendanceSummary.total > 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-[#F97316] rounded-full"
                        style={{ width: `${s.attendanceSummary.percentage ?? 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-[#0F172A]">{s.attendanceSummary.percentage}%</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">No records yet</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyStudents;
