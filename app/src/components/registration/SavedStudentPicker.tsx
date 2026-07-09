// ============================================================
//  components/registration/SavedStudentPicker.tsx
//
//  Shown instead of silently auto-filling the "latest" child when a
//  logged-in parent has MORE THAN ONE saved student. Lets them pick
//  which child this registration is for via radio-style options, or
//  skip and type in a new/different student manually.
//
//  Used by: Quick Register (ProgramCard.tsx), View Details
//  (ProgramDetails.tsx), and the chatbot (ChatbotRegistrationFlow.tsx —
//  that one renders its own copy inline since it doesn't use
//  RegistrationContext, but keeps the same look).
// ============================================================
import type { StudentWithSummary } from "../../types/parentDashboard";

export interface SavedStudentPickerProps {
  students: StudentWithSummary[];
  onSelect: (student: StudentWithSummary) => void;
  onSkip: () => void;
}

function calcAge(dob?: string): string {
  if (!dob) return "";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return `${age} yrs`;
}

function SavedStudentPicker({ students, onSelect, onSkip }: SavedStudentPickerProps) {
  if (!students || students.length < 2) return null;

  return (
    <div
      className="rounded-2xl border p-4 mb-4"
      style={{ borderColor: "var(--gold, #e5c675)", background: "var(--gold-glow, #fdf6e3)" }}
    >
      <p className="text-sm font-semibold mb-2" style={{ color: "var(--outfield, #1f2937)" }}>
        Who is this registration for?
      </p>
      <p className="text-xs mb-3" style={{ color: "var(--ink-400, #6b7280)" }}>
        You have {students.length} children saved on your account — pick one to fetch their
        details automatically.
      </p>

      <div className="space-y-2 mb-3">
        {students.map((s) => (
          <label
            key={s._id}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm cursor-pointer hover:border-[#A33B2B] transition-colors"
          >
            <input
              type="radio"
              name="saved-student-picker"
              value={s._id}
              onChange={() => onSelect(s)}
              className="h-4 w-4 accent-[#A33B2B]"
            />
            <span className="flex-1">
              <span className="font-medium">{s.firstName} {s.lastName}</span>
              {(s.gender || calcAge(s.dob)) && (
                <span className="ml-2 text-xs" style={{ color: "var(--ink-400, #6b7280)" }}>
                  {[s.gender, calcAge(s.dob)].filter(Boolean).join(" • ")}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="text-xs font-semibold underline"
        style={{ color: "var(--outfield, #1f2937)" }}
      >
        None of these — add a different student
      </button>
    </div>
  );
}

export default SavedStudentPicker;
