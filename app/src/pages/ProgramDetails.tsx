import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  HiUserGroup, HiShieldCheck, HiChartBar, HiLightningBolt,
} from "react-icons/hi";
import { HiOutlineArrowRight, HiOutlinePlusCircle, HiOutlineTrash } from "react-icons/hi2";
import BatchCard from "../components/BatchCard";
import programImage from "../assets/images/hero-cricket.jpg.jpg";
import { getProgramById, getBatches } from "../services/programService";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useRegistration } from "../context/RegistrationContext";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import GenderSelect from "../components/registration/GenderSelect";
// WEEKLY batchType support — same component + pricing helpers Quick Register
// uses, so "View Details" behaves identically for Weekly programs.
import WeeklyBatchSelector from "../components/registration/WeeklyBatchSelector";
import { calcWeeklyPrice, toWeeklyBatchSnapshots, type WeeklyBatchRaw } from "../utils/weeklyBatch";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TimeSlot { startTime: string; endTime: string; }
interface MonthOption { label: string; startDate: string; endDate: string; weeks: string | number; price?: string | number; }
interface BatchRaw {
  _id: string; name: string; title?: string; days: string;
  dayOfWeek?: string; multiDays?: string[]; timing: string;
  timeSlots?: TimeSlot[]; fee: number; price?: number;
  pricePerSession?: number; seats: number; maxCapacity?: number;
  currentCapacity?: number; sessionsPerWeek?: number;
  monthOptions?: MonthOption[];
  location?: { title?: string; city?: string; address?: string };
  groundLocationNote?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const DAY_FULL: Record<string, string> = {
  MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday",
  FRI: "Friday", SAT: "Saturday", SUN: "Sunday",
};
function fmt12(t: string): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr ?? "00"} ${ampm}`;
}
function getSlots(batch: BatchRaw): TimeSlot[] {
  if (batch.timeSlots && batch.timeSlots.length > 0) return batch.timeSlots;
  const parts = batch.timing?.split(" - ");
  if (parts?.length === 2) return [{ startTime: parts[0].trim(), endTime: parts[1].trim() }];
  return [];
}
function getLocationStr(batch: BatchRaw): string {
  if (batch.location?.address) return batch.location.address;
  if (batch.location?.city) return batch.location.city;
  if (batch.location?.title) return batch.location.title;
  if (batch.groundLocationNote) return batch.groundLocationNote;
  return "";
}
function buildDaySlotOptions(batch: BatchRaw): string[] {
  const slots = getSlots(batch);
  const locationSuffix = getLocationStr(batch) ? ` - ${getLocationStr(batch)}` : "";
  let days: string[] = [];
  if (batch.multiDays && batch.multiDays.length > 0) days = batch.multiDays.map((d) => DAY_FULL[d] ?? d);
  else if (batch.dayOfWeek && batch.dayOfWeek !== "MULTI") days = [DAY_FULL[batch.dayOfWeek] ?? batch.dayOfWeek];
  else if (batch.days) days = [batch.days];
  if (days.length === 0) return [];
  return days.map((day) => {
    if (slots.length > 0) {
      const s = slots[0];
      return `${day} - ${fmt12(s.startTime)} - ${fmt12(s.endTime)}${locationSuffix}`;
    }
    return `${day}${locationSuffix}`;
  });
}
function freqLabel(n: number): string {
  const m: Record<number, string> = { 1: "Once a Week", 2: "Twice a Week", 3: "Thrice a Week" };
  return m[n] ?? `${n} times a Week`;
}
function getDobError(value: string): string {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  const sel = new Date(year, month - 1, day);
  const today = new Date(); today.setHours(0, 0, 0, 0); sel.setHours(0, 0, 0, 0);
  return sel.getTime() > today.getTime() ? "Date of birth cannot be a future date" : "";
}

// ── Inline Registration Panel ─────────────────────────────────────────────────
function InlineRegistration({ programId, batches, programTitle, programImage, basePrice, batchType, weeklyBatches }: {
  programId: string;
  batches: BatchRaw[];
  programTitle: string;
  programImage?: string;
  basePrice?: number;
  batchType?: string;
  weeklyBatches?: WeeklyBatchRaw[];
}) {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { addItem } = useCart();
  const [cartSuccess, setCartSuccess] = useState(false);
  const {
    students, currentStudentIndex, setCurrentStudentIndex,
    updateStudent, addStudent, removeStudent,
    setSelectedBatch, setSelectedProgram,
  } = useRegistration();

  // Batch / month / day state
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<MonthOption | null>(null);
  const [selectedFreq, setSelectedFreq] = useState(1);
  const [daySlots, setDaySlots] = useState<(string | null)[]>([null]);

  // WEEKLY batchType: select one or more batches, price = basePrice × count.
  // Mirrors QuickRegisterDrawer in ProgramCard.tsx exactly.
  const isWeeklyProgram = batchType === "WEEKLY";
  const [selectedWeeklyBatchIds, setSelectedWeeklyBatchIds] = useState<string[]>([]);
  const weeklyTotalPrice = calcWeeklyPrice(basePrice ?? 0, selectedWeeklyBatchIds);

  // Step: "batch" = picking month/day, "student" = filling student form
  const [batchConfirmed, setBatchConfirmed] = useState(false);
  const studentFormRef = useRef<HTMLDivElement>(null);
  const [dobError, setDobError] = useState("");

  // Login modal — shown inline instead of navigating away
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const { login: doLogin } = useAuth();

  const activeBatch = batches.find((b) => b._id === selectedBatchId) ?? null;

  const baseMonthPrice = (() => {
    if (!selectedMonth) return 0;
    const direct = Number(selectedMonth.price);
    if (direct > 0) return direct;
    const match = activeBatch?.monthOptions?.find((m: any) => m.label === selectedMonth.label);
    const fromBatch = Number((match as any)?.price);
    return fromBatch > 0 ? fromBatch : 0;
  })();
  const totalPriceNonWeekly = baseMonthPrice > 0 ? baseMonthPrice * selectedFreq : 0;
  const totalPrice = isWeeklyProgram ? weeklyTotalPrice : totalPriceNonWeekly;

  const monthOpts: MonthOption[] = activeBatch?.monthOptions ?? [];
  const maxFreq = activeBatch?.sessionsPerWeek ?? 3;
  const freqOpts = Array.from({ length: maxFreq }, (_, i) => i + 1);
  const allDaySlotsSelected = daySlots.every((s) => s !== null);
  const canConfirm = isWeeklyProgram
    ? selectedWeeklyBatchIds.length > 0
    : Boolean(activeBatch) && Boolean(selectedMonth) && allDaySlotsSelected;

  useEffect(() => { setDaySlots(Array(selectedFreq).fill(null)); }, [selectedFreq]);

  const buildBatchContext = () => {
    if (isWeeklyProgram) {
      if (selectedWeeklyBatchIds.length === 0) return null;
      const snapshots = toWeeklyBatchSnapshots(weeklyBatches ?? [], selectedWeeklyBatchIds);
      return {
        _id: programId,
        name: programTitle,
        days: snapshots.map((s) => s.label).join(" + "),
        timing: snapshots.map((s) => `${s.startTime} - ${s.endTime}`).join(" | "),
        fee: weeklyTotalPrice,
        seats: 0,
        sessionsPerWeek: selectedWeeklyBatchIds.length,
        selectedWeeklyBatches: snapshots,
      };
    }
    if (!activeBatch || !selectedMonth) return null;
    return {
      _id: activeBatch._id, name: activeBatch.name,
      days: daySlots.filter(Boolean).join(" + "),
      timing: daySlots.filter(Boolean).join(" | "),
      fee: totalPrice, seats: activeBatch.seats,
      sessionsPerWeek: selectedFreq, selectedMonth, selectedFrequency: selectedFreq,
    };
  };

  // ── FIX: setSelectedProgram is now called here so ReviewOrder sees the program ──
  const handleConfirm = () => {
    const batchCtx = buildBatchContext();
    if (!batchCtx) return;
    setSelectedBatch(batchCtx as any);
    setSelectedProgram({ _id: programId, title: programTitle } as any); // FIX
    updateStudent(currentStudentIndex, { selectedBatch: batchCtx as any });
    setBatchConfirmed(true);
    setTimeout(() => studentFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const student = students[currentStudentIndex] ?? students[0];
  const isStudentValid = Boolean(
    student?.firstName?.trim() && student?.lastName?.trim() &&
    student?.dob && !dobError && student?.gender
  );

  const handleStudentChange = (field: string, value: string) =>
    updateStudent(currentStudentIndex, { [field]: value });

  const handleDobChange = (value: string) => {
    handleStudentChange("dob", value);
    setDobError(getDobError(value));
  };

  const handleAddStudent = () => {
    if (!isStudentValid) return;
    const batchCtx = buildBatchContext() ?? student?.selectedBatch;
    addStudent({ firstName: "", lastName: "", dob: "", gender: "", schoolName: "", medicalNotes: "", selectedBatch: batchCtx as any });
    setCurrentStudentIndex(students.length);
    setDobError("");
    setTimeout(() => studentFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  // ── FIX: setSelectedProgram called before navigating so context is populated ──
  const handleContinue = () => {
    if (!isStudentValid) return;
    setSelectedProgram({ _id: programId, title: programTitle } as any); // FIX
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    navigate("/review-order");
  };

  const handleAddToCart = () => {
    if (!isStudentValid || !batchConfirmed) return;
    const batchCtx = buildBatchContext();
    if (!batchCtx) return;
    // Collect all current students into a cart item
    const cartStudents = students
      .filter((s) => s.firstName.trim() && s.lastName.trim())
      .map((s) => ({
        firstName: s.firstName,
        lastName: s.lastName,
        dob: s.dob,
        gender: s.gender,
        schoolName: s.schoolName,
        medicalNotes: s.medicalNotes,
      }));
    if (cartStudents.length === 0) return;
    addItem({
      programId,
      programTitle,
      programImage,
      batchId: batchCtx._id,
      batchName: batchCtx.name,
      selectedMonth: (batchCtx as any).selectedMonth?.label ?? "",
      selectedDays: batchCtx.days,
      sessionsPerWeek: batchCtx.sessionsPerWeek ?? 1,
      fee: batchCtx.fee,
      students: cartStudents,
    });
    setCartSuccess(true);
    setTimeout(() => setCartSuccess(false), 3000);
  };

  // ── FIX: setSelectedProgram called after login so context is populated before navigation ──
  const handleModalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await doLogin(loginEmail, loginPassword);
      setSelectedProgram({ _id: programId, title: programTitle } as any); // FIX
      setShowLoginModal(false);
      navigate("/review-order");
    } catch (err: any) {
      setLoginError(err?.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoginLoading(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 w-full">

      {/* ── STEP 1: Header ── */}
      <div>
        {/* <p className="text-sm tracking-[0.1em] text-[#A33B2B] font-semibold">Batch Details</p> */}
        {!batchConfirmed
          ? <h2 className="mt-1 text-md font-bold text-[#0F172A]">Select Batch Details</h2>
          : (
            <div className="flex items-center gap-2 mt-1">
              <button type="button" onClick={() => setBatchConfirmed(false)}
                className="text-md font-medium text-[#A33B2B] hover:underline">
                ← Change selection
              </button>
            </div>
          )
        }
      </div>

      {/* ── WEEKLY batchType: Select Batch → Select Week (multi-select, price = base × count) ── */}
      {!batchConfirmed && isWeeklyProgram && (
        <div className="space-y-4">
          {(!weeklyBatches || weeklyBatches.length === 0) ? (
            <p className="text-md text-slate-800 text-center py-6">No batches available.</p>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                This is a Weekly program — select one or more batches below. Price = base price × number
                of batches selected.
              </p>
              <WeeklyBatchSelector
                batches={weeklyBatches}
                basePrice={basePrice ?? 0}
                selectedIds={selectedWeeklyBatchIds}
                onChange={setSelectedWeeklyBatchIds}
              />
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div className="flex flex-col items-start">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Total</p>
                  <p className="text-xl font-bold text-[#0F172A]">${weeklyTotalPrice || "—"}</p>
                </div>
                <button type="button" disabled={!canConfirm} onClick={handleConfirm}
                  className="inline-flex items-center gap-2 rounded-full bg-green-800 px-5 py-2.5 text-md font-semibold text-white shadow-md hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next — Student Details <HiOutlineArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Batch cards (REGULAR / FIXED_DAYS / SPECIAL_CAMP programs only) ── */}
      {!batchConfirmed && !isWeeklyProgram && (
        <div className="space-y-3 pr-1">
          {batches.length === 0 && (
            <p className="text-md text-slate-800 text-center py-6">No batches available.</p>
          )}

          {batches.map((batch) => {
            const isSelected = selectedBatchId === batch._id;
            const bMonthOpts = batch.monthOptions ?? [];
            const bMaxFreq = batch.sessionsPerWeek ?? 3;
            const bFreqOpts = Array.from({ length: bMaxFreq }, (_, i) => i + 1);

            return (
              <div key={batch._id}
                className={`rounded-2xl border transition ${isSelected
                  ? "border-green-300 bg-green-50 "
                  : "border-slate-200 bg-slate-50"}`}
              >
                {/* Batch name row */}
                {/* <div className="px-4 pt-4 pb-2">
                  <p className="text-xl font-bold text-[#0F172A]">
                    {batch.title || batch.name}
                  </p>
                  {(() => {
                    if (isSelected && selectedMonth) {
                      return (
                        <p className="text-xs text-[#A33B2B] font-semibold mt-0.5">
                          ${totalPrice || baseMonthPrice || basePrice || 0}
                        </p>
                      );
                    }
                    return basePrice ? (
                      <p className="text-xs text-[#A33B2B] font-semibold mt-0.5">
                        From ${basePrice}
                      </p>
                    ) : null;
                  })()}
                </div> */}

                <div className="px-4 pb-4 space-y-4 border-t border-slate-200 pt-3">
                  {/* Select Month */}
                  {bMonthOpts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Select Month</p>
                      <div className="flex flex-wrap gap-2">
                        {bMonthOpts.map((opt, oi) => {
                          const isChecked = isSelected && selectedMonth?.label === opt.label;
                          return (
                            <label key={oi}
                              className={`flex items-center gap-1.5 cursor-pointer text-sm px-3 py-1.5 font-semibold rounded-full border transition ${isChecked
                                ? "border-green-200 bg-green-800 text-white"
                                : "border-slate-300 bg-white text-slate-700 hover:border-green-500"}`}
                            >
                              <input type="radio" name={`month-${batch._id}`} checked={isChecked}
                                onChange={() => {
                                  setSelectedBatchId(batch._id);
                                  setSelectedMonth(opt);
                                  setSelectedFreq(1);
                                  setDaySlots([null]);
                                }}
                                className="sr-only"
                              />
                              {opt.label}
                              {opt.price ? ` · $${opt.price}` : ""}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* No month options — simple select */}
                  {bMonthOpts.length === 0 && (
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                      <input type="radio" name={`batch-sel-${batch._id}`} checked={isSelected}
                        onChange={() => {
                          setSelectedBatchId(batch._id);
                          setSelectedMonth({
                            label: batch.name,
                            startDate: "",
                            endDate: "",
                            weeks: "",
                            price: batch.price ?? batch.fee ?? basePrice ?? 0,
                          });
                          setSelectedFreq(1);
                          setDaySlots([null]);
                        }}
                        className="w-4 h-4 accent-[#A33B2B]"
                      />
                      Select this batch
                    </label>
                  )}

                  {/* Frequency + Day pickers (only when this batch selected) */}
                  {isSelected && selectedMonth && (
                    <>
                      {/* Frequency */}
                      {bFreqOpts.length > 1 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Frequency</p>
                          <div className="flex flex-wrap gap-2">
                            {bFreqOpts.map((n) => (
                              <label key={n}
                                className={`flex items-center gap-1.5 cursor-pointer text-sm px-3 py-1.5 font-semibold rounded-full border transition ${selectedFreq === n
                                   ? "border-green-200 bg-green-800 text-white"
                                : "border-slate-300 bg-white text-slate-700 hover:border-green-500"}`}
                              >
                                <input type="radio" name={`freq-${batch._id}`} checked={selectedFreq === n}
                                  onChange={() => { setSelectedFreq(n); setDaySlots(Array(n).fill(null)); }}
                                  className="sr-only"
                                />
                                {freqLabel(n)}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Day selectors */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Select Day{selectedFreq > 1 ? "s" : ""}</p>
                        <div className="space-y-2">
                          {Array.from({ length: selectedFreq }).map((_, di) => (
                            <select key={di}
                              value={daySlots[di] ?? ""}
                              onChange={(e) => {
                                const val = e.target.value || null;
                                setDaySlots((prev) => { const next = [...prev]; next[di] = val; return next; });
                              }}
                              className="w-full rounded-xl border px-3 py-2 text-sm bg-white text-slate-900 outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-600/15"
                              style={{ borderColor: daySlots[di] ? "#07c245" : "#e2e8f0" }}
                            >
                              <option value="">Select Day {selectedFreq > 1 ? di + 1 : ""}</option>
                              {buildDaySlotOptions(batch)
                                .filter((opt) => opt === daySlots[di] || !daySlots.some((s, si) => si !== di && s === opt))
                                .map((opt, oi) => <option key={oi} value={opt}>{opt}</option>)}
                            </select>
                          ))}
                        </div>
                      </div>

                      {/* Price + Confirm button */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <div className="flex flex-col items-start">
                          <p className="text-xs text-slate-400 uppercase tracking-wide">Total</p>
                          <p className="text-xl font-bold text-[#0F172A]">${totalPrice || "—"}</p>
                        </div>
                        <button type="button" disabled={!canConfirm} onClick={handleConfirm}
                          className="inline-flex items-center gap-2 rounded-full bg-green-800 px-5 py-2.5 text-md font-semibold text-white shadow-md hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          Next — Student Details <HiOutlineArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── STEP 2: Student Details (shown inline after confirm) ── */}
      {batchConfirmed && student && (
        <div ref={studentFormRef} className="space-y-4">
          {/* Confirmed batch summary */}
          <div className="rounded-xl bg-green-50 border border-green-500 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Selected</p>
              <p className="text-sm font-semibold text-[#0F172A]">
                {activeBatch?.title || activeBatch?.name} · {selectedMonth?.label}
              </p>
              <p className="text-xs text-slate-500">{daySlots.filter(Boolean).join(" + ")}</p>
            </div>
            <p className="text-lg font-bold text-green-800">${totalPrice}</p>
          </div>

          {/* Student header */}
          <div>
            <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-600 text-sm font-bold text-white">
                {currentStudentIndex + 1}
              </span>
              <span>{students.length > 1 ? `of ${students.length} Students` : "Student"}</span>
            </h2>
            {students.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {students.map((_, i) => (
                  <button key={i} type="button"
                    onClick={() => { setCurrentStudentIndex(i); setDobError(""); }}
                    className={`h-8 w-8 rounded-full border text-xs font-bold transition ${i === currentStudentIndex
                      ? "border-slate-600 bg-slate-600 text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:border-slate-600"}`}
                  >{i + 1}</button>
                ))}
              </div>
            )}
          </div>

          {/* Form fields */}
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={student.firstName}
                  onChange={(e) => handleStudentChange("firstName", e.target.value)}
                  placeholder="Alex"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-600/15"
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={student.lastName}
                  onChange={(e) => handleStudentChange("lastName", e.target.value)}
                  placeholder="Patel"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-600/15"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input type="date" value={student.dob}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => handleDobChange(e.target.value)}
                  className={`w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 ${dobError ? "border-red-400 focus:ring-red-400/15" : "border-slate-200 focus:border-slate-600 focus:ring-slate-600/15"}`}
                />
                {dobError && <p className="mt-1 text-xs font-semibold text-red-500">{dobError}</p>}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Gender <span className="text-red-500">*</span>
                </label>
                <GenderSelect
                  value={student.gender}
                  onChange={(value) => handleStudentChange("gender", value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-600/15"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">School Name</label>
              <input type="text" value={student.schoolName}
                onChange={(e) => handleStudentChange("schoolName", e.target.value)}
                placeholder="Sunrise High School"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-600/15"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Medical Notes</label>
              <textarea rows={2} value={student.medicalNotes}
                onChange={(e) => handleStudentChange("medicalNotes", e.target.value)}
                placeholder="Allergies or important health info..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-600/15 resize-none"
              />
            </div>

            {students.length > 1 && (
              <button type="button"
                onClick={() => { removeStudent(currentStudentIndex); setCurrentStudentIndex(Math.max(0, currentStudentIndex - 1)); setDobError(""); }}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
              >
                <HiOutlineTrash className="h-3.5 w-3.5" /> Remove this student
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-1 border-t border-slate-200">
            <button type="button" onClick={handleAddStudent} disabled={!isStudentValid}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-[#A33B2B] bg-white px-3 py-2.5 text-xs font-semibold text-[#A33B2B] hover:bg-[#A33B2B]/5 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <HiOutlinePlusCircle className="h-4 w-4" /> Add Another Student
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={handleAddToCart}
                disabled={!isStudentValid || !batchConfirmed}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-2.5 text-md font-bold disabled:opacity-40 disabled:cursor-not-allowed transition"
                style={{ borderColor: "var(--outfield)", color: "var(--outfield)", background: cartSuccess ? "var(--pitch-soft)" : "white" }}
              >
                {cartSuccess ? "✓ Added!" : "🛒 Add Registration"}
              </button>
              <button type="button" onClick={handleContinue} disabled={!isStudentValid}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#A33B2B] px-3 py-2.5 text-md font-bold text-white shadow-md hover:bg-[#ea7a2e] disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Registration Now <HiOutlineArrowRight className="h-4 w-4" />
              </button>
            </div>
            {cartSuccess && (
              <button
                type="button"
                onClick={() => navigate("/cart")}
                className="w-full text-center text-xs font-semibold transition hover:underline"
                style={{ color: "var(--gold)" }}
              >
                View Cart →
              </button>
            )}
          </div>

          {!isLoggedIn && (
            <p className="text-xs text-slate-400 text-center">Sign in or create an account before completing purchase.</p>
          )}
        </div>
      )}

      {/* ── Inline Login Modal ── */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-[24px] bg-white p-7 shadow-2xl"
            style={{ border: "1px solid var(--pitch-deep)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#A33B2B" }}>One more step</p>
                <h2 className="text-lg font-bold text-[#0F172A] mt-0.5">Sign in to continue</h2>
                <p className="text-xs text-slate-500 mt-1">Your registration details are saved — just sign in and we'll take you straight to review.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="ml-3 shrink-0 rounded-full h-7 w-7 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition text-lg"
              >✕</button>
            </div>

            {loginError && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-600">{loginError}</div>
            )}

            <form onSubmit={handleModalLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Email</label>
                <input
                  type="email" required autoFocus
                  value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="parent@email.com"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-[#A33B2B] focus:ring-2 focus:ring-[#A33B2B]/20 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Password</label>
                <input
                  type="password" required
                  value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-[#A33B2B] focus:ring-2 focus:ring-[#A33B2B]/20 transition"
                />
              </div>
              <button
                type="submit" disabled={loginLoading}
                className="w-full rounded-full py-3 text-sm font-bold transition disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] mt-1"
                style={{ background: "#A33B2B", color: "white" }}
              >
                {loginLoading ? "Signing in..." : "Sign In & Continue to Review"}
              </button>
            </form>

            <div className="mt-4 text-center">
              <span className="text-xs text-slate-500">Don't have an account? </span>
              <button
                type="button"
                onClick={() => { setShowLoginModal(false); navigate("/login", { state: { from: `/programs/${programId}` } }); }}
                className="text-xs font-semibold hover:underline"
                style={{ color: "#A33B2B" }}
              >
                Create one
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ProgramDetails page ──────────────────────────────────────────────────
function ProgramDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [program, setProgram] = useState<any | null>(null);
  const [batches, setBatches] = useState<BatchRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true); setError("");
      try {
        const data = await getProgramById(id);
        setProgram(data ?? null);
        const raw: BatchRaw[] = Array.isArray(data?.batches)
          ? data.batches.map((b: any) => ({
              _id: b._id,
              name: b.name ?? b.title ?? `Batch ${b._id}`,
              title: b.title,
              days: b.days ?? "",
              dayOfWeek: b.dayOfWeek,
              multiDays: b.multiDays,
              timing: b.timing ?? "",
              timeSlots: b.timeSlots,
              fee: Number(b.price ?? b.fee ?? 0),
              price: Number(b.price ?? b.fee ?? 0),
              pricePerSession: Number(b.pricePerSession ?? b.price ?? b.fee ?? 0),
              seats: Number(b.maxCapacity ?? b.seats ?? 0),
              maxCapacity: Number(b.maxCapacity ?? b.seats ?? 0),
              currentCapacity: Number(b.currentCapacity ?? 0),
              sessionsPerWeek: b.sessionsPerWeek,
              monthOptions: Array.isArray(b.monthOptions) ? b.monthOptions : [],
              location: b.location,
              groundLocationNote: b.groundLocationNote,
            }))
          : [];
        setBatches(raw);
      } catch {
        setError("Unable to load program");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return (
    <><Navbar /><div className="h-20" />
    <main className="bg-white text-[#0F172A]">
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">Loading program...</div>
    </main><Footer /></>
  );
  if (error || !program) return (
    <><Navbar /><div className="h-20" />
    <main className="bg-white text-[#0F172A]">
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">{error || "Program not found"}</div>
    </main><Footer /></>
  );

  const p = program;
  const displayBatches = batches;
  const coverImage = p.coverImageUrl ?? programImage;
  const programMeta = [
    { label: "Location", value: p.location?.title || p.location?.city || p.location?.address },
    { label: "Category", value: p.category?.title },
    { label: "Level", value: Array.isArray(p.skillLevels) ? p.skillLevels.join(", ") : p.skillLevels },
    { label: "Age", value: Array.isArray(p.ageGroups) ? p.ageGroups.join(", ") : p.ageGroups },
    {
      label: "Price",
      value: p.discountedPrice ? `$${p.discountedPrice}` : p.basePrice ? `$${p.basePrice}` : "Contact us",
    },
  ].filter((item) => Boolean(item.value));

  const benefits = [
    { icon: HiLightningBolt, title: "High-impact training", description: "Accelerated skill growth through focused practice sessions." },
    { icon: HiShieldCheck, title: "Performance coaching", description: "Expert-led development with pro-level game preparation." },
    { icon: HiChartBar, title: "Tactical advancement", description: "Match-ready strategies and situational awareness training." },
    { icon: HiUserGroup, title: "Team engagement", description: "Group drills and mentorship for stronger on-field chemistry." },
  ];

  return (
    <>
      <Navbar />
      <div className="h-20" />
      <main className="bg-white text-[#0F172A]">

        {/* ── Hero: Full-width background image + centered registration ── */}
        <section className="relative overflow-hidden pb-14 pt-12 md:pb-20 md:pt-16">
          <div className="absolute inset-x-0 top-0 h-[520px] md:h-[620px] pointer-events-none">
            <img
              src={coverImage}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = programImage; }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-white" />
            <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-white/0 to-white" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mx-auto max-w-4xl"
            >
              <div className="rounded-[24px] border border-white/70 bg-white/95 p-5 shadow-2xl backdrop-blur-xl sm:p-7 md:p-8">
                <div className="border-b border-slate-200 pb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A33B2B]">Program Registration</p>
                  <h1 className="mt-2 text-3xl font-bold leading-tight text-[#0F172A] sm:text-4xl">{p.title}</h1>
                  {(p.shortDescription || p.detailedDescription) && (
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                      {p.shortDescription || p.detailedDescription}
                    </p>
                  )}
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {programMeta.map((item) => (
                      <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{item.label}</p>
                        <p className="mt-1 text-sm font-bold text-[#0F172A]">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-6">
                  <InlineRegistration programId={p._id} batches={displayBatches} programTitle={p.title ?? ""} programImage={coverImage} basePrice={p.discountedPrice ?? p.basePrice} batchType={p.batchType} weeklyBatches={p.weeklyBatches} />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Program Overview ── */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
            className="rounded-[24px] bg-white p-8 md:p-12 shadow-lg">
            <h2 className="text-3xl sm:text-4xl font-bold">Program Overview</h2>
            <p className="mt-4 text-slate-600 leading-8">{p.detailedDescription || p.shortDescription}</p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {benefits.map((b) => {
                const Icon = b.icon;
                return (
                  <motion.div key={b.title} whileHover={{ y: -4 }}
                    className="rounded-[24px] border border-slate-200 bg-[#f8fafc] p-6 shadow-sm">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#A33B2B]/10 text-[#A33B2B]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold">{b.title}</h3>
                    <p className="mt-3 text-slate-600 leading-7">{b.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </section>

        {/* ── Available Batches ── */}
        {displayBatches.length > 0 && (
          <section className="max-w-7xl mx-auto px-6 py-12">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
              className="rounded-[24px] bg-[#fff7ed] p-8 shadow-lg">
              <h2 className="text-3xl sm:text-4xl font-bold">Available Batches</h2>
              <p className="mt-3 text-slate-600">Choose the schedule that fits your routine.</p>
              <div className="mt-10 grid gap-6 lg:grid-cols-3">
                {displayBatches.map((batch) => (
                  <BatchCard
                    key={batch._id || batch.name}
                    name={batch.title || batch.name || `${batch.dayOfWeek} Batch`}
                    days={Array.isArray(batch.multiDays) && batch.multiDays.length ? batch.multiDays.join(", ") : batch.dayOfWeek ?? ""}
                    timing={`${getSlots(batch)[0]?.startTime ?? ""} - ${getSlots(batch)[0]?.endTime ?? ""}`}
                    fee={batch.price ?? 0}
                    seats={(batch.maxCapacity ?? 0) - (batch.currentCapacity ?? 0)}
                  />
                ))}
              </div>
            </motion.div>
          </section>
        )}

        {/* ── CTA Banner ── */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }}
            className="rounded-[24px] bg-gradient-to-r from-[#A33B2B] via-[#fb923c] to-[#fde68a] p-10 shadow-2xl">
            <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr] items-center">
              <div>
                <h2 className="text-4xl font-bold text-white">Ready to elevate your game?</h2>
                <p className="mt-4 max-w-2xl text-white/90 leading-8">Secure your place in a premium cricket training program.</p>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-end">
                <button onClick={() => navigate(`/register-program/${p._id}`)}
                  className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0F172A] transition hover:bg-slate-100">
                  Register Now
                </button>
              </div>
            </div>
          </motion.div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default ProgramDetails;