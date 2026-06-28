// ============================================================
//  pages/dashboard/StudentDetail.tsx
//  Single student deep-dive: full attendance log, enrolled
//  programs, and a "Download ID Card" button that generates a
//  printable QR-code ID card PDF on the client. No photo upload —
//  the academy does not collect or print student photos; the ID
//  card identifies a student via a scannable QR code instead.
// ============================================================
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  HiOutlineArrowLeft,
  HiOutlineIdentification,
  HiOutlineCalendarDays,
  HiOutlineAcademicCap,
} from "react-icons/hi2";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import {
  getStudentDetail,
  type StudentDetailResponse,
} from "../../services/parentDashboardService";
import StatusBadge from "../../components/dashboard/StatusBadge";
import { buildIdCardPdf } from "../../utils/pdfGenerators";

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [detail, setDetail] = useState<StudentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingCard, setDownloadingCard] = useState(false);

  const load = () => {
    if (!token || !id) return;
    setLoading(true);
    getStudentDetail(token, id)
      .then(setDetail)
      .catch(() => setError("Couldn't load this student's details. Please try again."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token, id]);

  const handleDownloadIdCard = async () => {
    if (!detail) return;
    setDownloadingCard(true);
    try {
      const programTitle = detail.registrations[0]?.programId?.title;
      await buildIdCardPdf(detail.student, programTitle);
    } catch {
      toast.error("Couldn't generate the ID card. Please try again.");
    } finally {
      setDownloadingCard(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-40 bg-slate-200 rounded-full" />
        <div className="h-48 rounded-3xl bg-white ring-1 ring-slate-200/60" />
        <div className="h-64 rounded-3xl bg-white ring-1 ring-slate-200/60" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-sm text-red-600">
        {error || "Student not found."}
      </div>
    );
  }

  const { student, registrations, attendance, attendanceSummary } = detail;

  return (
    <div className="space-y-6">
      <Link to="/dashboard/students" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[#0F172A]">
        <HiOutlineArrowLeft className="h-4 w-4" />
        Back to My Students
      </Link>

      {/* Profile header card */}
      <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm ring-1 ring-slate-200/60">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center text-2xl font-bold">
              {student.firstName[0]}{student.lastName[0]}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-[#0F172A]">{student.firstName} {student.lastName}</h1>
                <p className="text-sm text-slate-400 font-mono mt-0.5">{student.studentCode}</p>
              </div>
              <button
                onClick={handleDownloadIdCard}
                disabled={downloadingCard}
                className="inline-flex items-center gap-2 rounded-full bg-[#0F172A] text-white px-5 py-2.5 text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-60"
              >
                <HiOutlineIdentification className="h-4 w-4" />
                {downloadingCard ? "Preparing..." : "Download ID Card"}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 text-sm">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Date of Birth</p>
                <p className="font-medium text-[#0F172A] mt-0.5">{formatDate(student.dob)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Gender</p>
                <p className="font-medium text-[#0F172A] mt-0.5">{student.gender || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">School</p>
                <p className="font-medium text-[#0F172A] mt-0.5">{student.schoolName || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard label="Present" value={attendanceSummary.present} color="text-green-600" />
        <SummaryCard label="Absent" value={attendanceSummary.absent} color="text-red-600" />
        <SummaryCard label="Late" value={attendanceSummary.late ?? 0} color="text-amber-600" />
        <SummaryCard
          label="Attendance Rate"
          value={attendanceSummary.percentage !== null ? `${attendanceSummary.percentage}%` : "—"}
          color="text-[#A33B2B]"
        />
      </div>

      {/* Enrolled programs */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="text-lg font-bold text-[#0F172A] mb-4">Enrolled Programs</h2>
        {registrations.length === 0 ? (
          <p className="text-sm text-slate-500">No programs registered for this student yet.</p>
        ) : (
          <div className="space-y-3">
            {registrations.map((r) => (
              <div key={r._id} className="flex items-center gap-4 rounded-2xl border border-slate-100 p-4">
                <div className="w-10 h-10 rounded-xl bg-[#FEF4E6] flex items-center justify-center flex-shrink-0">
                  <HiOutlineAcademicCap className="h-5 w-5 text-[#A33B2B]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#0F172A] truncate">{r.programId?.title || "CCA Program"}</p>
                  <p className="text-xs text-slate-400 font-mono">{r.registrationNumber}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full attendance log */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="text-lg font-bold text-[#0F172A] mb-4">Attendance Log</h2>
        {attendance.length === 0 ? (
          <div className="text-center py-8">
            <HiOutlineCalendarDays className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No attendance has been recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Program</th>
                  <th className="px-2 py-2">Batch</th>
                  <th className="px-2 py-2">Note</th>
                  <th className="px-2 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a._id} className="border-t border-slate-100">
                    <td className="px-2 py-3 text-slate-600 whitespace-nowrap">{formatDate(a.date)}</td>
                    <td className="px-2 py-3 text-slate-500">{a.programId?.title || "—"}</td>
                    <td className="px-2 py-3 text-slate-500">{a.batchId?.title || "—"}</td>
                    <td className="px-2 py-3 text-slate-400">{a.note || "—"}</td>
                    <td className="px-2 py-3 text-right"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export default StudentDetail;
