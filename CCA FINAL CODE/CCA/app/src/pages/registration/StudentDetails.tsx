import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineArrowLeft, HiOutlineArrowRight, HiOutlinePlusCircle, HiOutlineTrash } from "react-icons/hi2";
import { useRegistration } from "../../context/RegistrationContext";

function StudentDetails() {
  const navigate = useNavigate();
  const {
    students,
    currentStudentIndex,
    setCurrentStudentIndex,
    updateStudent,
    addStudent,
    removeStudent,
    selectedBatch,
  } = useRegistration();

  const student = students[currentStudentIndex];
  const [showAddChild, setShowAddChild] = useState(false);
  const [sameBatch, setSameBatch] = useState<boolean | null>(null);

  const handleChange = (field: string, value: string) => {
    updateStudent(currentStudentIndex, { [field]: value });
  };

  const isStudentValid =
    student.firstName.trim() &&
    student.lastName.trim() &&
    student.dob &&
    student.gender;

  // After filling student details — ask "Add another child?"
  const handleContinue = () => {
    if (!isStudentValid) return;
    setShowAddChild(true);
  };

  const handleAddAnotherChild = (yes: boolean) => {
    if (yes) {
      // Ask same batch or different
      setSameBatch(null);
      setShowAddChild(false);
      // show same batch question UI — handled below
      setShowSameBatchQuestion(true);
    } else {
      // No more children — go to billing/account step
      navigate("/review-order");
    }
  };

  const [showSameBatchQuestion, setShowSameBatchQuestion] = useState(false);

  const handleSameBatchAnswer = (isSame: boolean) => {
    setSameBatch(isSame);
    setShowSameBatchQuestion(false);

    if (isSame) {
      // Add new student with same batch, stay on student details
      addStudent({
        firstName: "",
        lastName: "",
        dob: "",
        gender: "",
        schoolName: "",
        medicalNotes: "",
        selectedBatch: selectedBatch,
      });
      setCurrentStudentIndex(students.length); // next index
    } else {
      // Go back to Phase 2 (program selection) for new child with new batch
      navigate(-1); // goes back to ProgramSelection where they pick a new batch
    }
  };

  // Guard
  if (!student) return null;

  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#0F172A]">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-6 py-10 sm:py-14">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#F97316] transition"
        >
          <HiOutlineArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="mt-6 rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-200/60 sm:p-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-widest text-[#F97316]">Phase 3 — Student Details</p>
              <h1 className="mt-2 text-3xl font-bold text-[#0F172A]">
                Student {currentStudentIndex + 1} of {students.length}
              </h1>
              <p className="mt-2 text-slate-600 text-sm">Fill in the details for this student.</p>
            </div>
            <div className="rounded-full bg-[#F97316]/10 px-4 py-2 text-sm font-semibold text-[#F97316]">
              {students.length} Student{students.length > 1 ? "s" : ""} in Cart
            </div>
          </div>

          {/* Progress */}
          <div className="mt-6 overflow-hidden rounded-full bg-slate-100 h-2">
            <div className="h-2 rounded-full bg-[var(--gold)]" style={{ width: "40%" }} />
          </div>
          <p className="mt-2 text-xs text-slate-400 text-right">Step 2 of 5</p>
        </div>
      </section>

      {/* Form */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-200/70 sm:p-10">
              <p className="text-sm uppercase tracking-widest text-slate-500">Student Information</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#0F172A]">Personal Details</h2>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <label className="block text-sm font-semibold text-slate-700">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={student.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    placeholder="Alex"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <label className="block text-sm font-semibold text-slate-700">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={student.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    placeholder="Patel"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <label className="block text-sm font-semibold text-slate-700">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={student.dob}
                    onChange={(e) => handleChange("dob", e.target.value)}
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <label className="block text-sm font-semibold text-slate-700">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={student.gender}
                    onChange={(e) => handleChange("gender", e.target.value)}
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
                  >
                    <option value="">Choose gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <label className="block text-sm font-semibold text-slate-700">School Name</label>
                <input
                  type="text"
                  value={student.schoolName}
                  onChange={(e) => handleChange("schoolName", e.target.value)}
                  placeholder="Sunrise High School"
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
                />
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <label className="block text-sm font-semibold text-slate-700">Medical Notes</label>
                <textarea
                  rows={4}
                  value={student.medicalNotes}
                  onChange={(e) => handleChange("medicalNotes", e.target.value)}
                  placeholder="Allergies or important health info..."
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
                />
              </div>

              {/* Multiple students - remove button */}
              {students.length > 1 && (
                <div className="mt-4 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      removeStudent(currentStudentIndex);
                      setCurrentStudentIndex(Math.max(0, currentStudentIndex - 1));
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition"
                  >
                    <HiOutlineTrash className="h-4 w-4" />
                    Remove this student
                  </button>

                  {students.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentStudentIndex(i)}
                      className={`h-8 w-8 rounded-full border text-xs font-bold transition ${
                        i === currentStudentIndex
                          ? "border-[#F97316] bg-[#F97316] text-white"
                          : "border-slate-300 bg-white text-slate-600 hover:border-[#F97316]"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}

              {/* Navigation */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:border-[#F97316] transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={!isStudentValid}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F97316] px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#ea7a2e] disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Continue <HiOutlineArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-5">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-lg ring-1 ring-slate-200/70">
              <p className="text-sm uppercase tracking-widest text-[#F97316]">Profile Preview</p>
              <h2 className="mt-3 text-xl font-semibold text-[#0F172A]">Student {currentStudentIndex + 1}</h2>
              <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
                {[
                  {
                    label: "Full Name",
                    value:
                      `${student.firstName} ${student.lastName}`.trim() || "—",
                  },
                  { label: "Date of Birth", value: student.dob || "—" },
                  { label: "Gender", value: student.gender || "—" },
                  { label: "School", value: student.schoolName || "—" },
                  { label: "Batch", value: student.selectedBatch?.name ?? selectedBatch?.name ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-[#0F172A]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-widest text-slate-500">Quick Tips</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li className="rounded-xl bg-slate-50 p-3">Use full legal name for enrollment.</li>
                <li className="rounded-xl bg-slate-50 p-3">Medical notes help coaches prepare.</li>
                <li className="rounded-xl bg-slate-50 p-3">You can add multiple children.</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      {/* ── "Add Another Child?" Modal ── */}
      {showAddChild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl">
            <p className="text-xs uppercase tracking-widest text-[#F97316] font-semibold">Multi-Student</p>
            <h2 className="mt-2 text-2xl font-bold text-[#0F172A]">Add another child?</h2>
            <p className="mt-3 text-slate-600 text-sm">
              Would you like to enroll another child in this registration?
            </p>
            <div className="mt-6 flex gap-4">
              <button
                type="button"
                onClick={() => handleAddAnotherChild(true)}
                className="flex-1 rounded-full bg-[#F97316] py-3 text-sm font-semibold text-white shadow-md hover:bg-[#ea7a2e] transition"
              >
                Yes, Add Child
              </button>
              <button
                type="button"
                onClick={() => handleAddAnotherChild(false)}
                className="flex-1 rounded-full border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:border-[#F97316] transition"
              >
                No, Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── "Same Batch?" Modal ── */}
      {showSameBatchQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl">
            <p className="text-xs uppercase tracking-widest text-blue-600 font-semibold">New Child Batch</p>
            <h2 className="mt-2 text-2xl font-bold text-[#0F172A]">Same batch?</h2>
            <p className="mt-3 text-slate-600 text-sm">
              Should the new child join the same batch as{" "}
              <strong>{students[currentStudentIndex]?.firstName || "previous student"}</strong>?
            </p>
            {selectedBatch && (
              <div className="mt-3 rounded-xl bg-orange-50 border border-orange-200 p-3 text-sm text-[#F97316] font-medium">
                Current batch: {selectedBatch.name} — ${selectedBatch.fee}
              </div>
            )}
            <div className="mt-6 flex gap-4">
              <button
                type="button"
                onClick={() => handleSameBatchAnswer(true)}
                className="flex-1 rounded-full bg-[#F97316] py-3 text-sm font-semibold text-white shadow-md hover:bg-[#ea7a2e] transition"
              >
                Yes, Same Batch
              </button>
              <button
                type="button"
                onClick={() => handleSameBatchAnswer(false)}
                className="flex-1 rounded-full border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:border-[#F97316] transition"
              >
                No, New Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default StudentDetails;
