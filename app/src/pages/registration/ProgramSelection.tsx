import { useEffect, useState, useRef } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { HiOutlineArrowLeft, HiOutlineArrowRight, HiOutlinePlusCircle, HiOutlineTrash } from "react-icons/hi2";
import { useRegistration } from "../../context/RegistrationContext";
import { getProgramById } from "../../services/programService";
import type { Program } from "../../types/program";
import GenderSelect from "../../components/registration/GenderSelect";
import WeeklyBatchSelector from "../../components/registration/WeeklyBatchSelector";
import { calcWeeklyPrice, toWeeklyBatchSnapshots, type WeeklyBatchRaw } from "../../utils/weeklyBatch";

// ─── DOB validator (same logic as StudentDetails) ─────────────────────────────
function getDobError(value: string): string {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  const sel = new Date(year, month - 1, day);
  const today = new Date(); today.setHours(0,0,0,0); sel.setHours(0,0,0,0);
  return sel.getTime() > today.getTime() ? "Date of birth cannot be a future date" : "";
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface TimeSlot { startTime: string; endTime: string; }
interface MonthOption { label: string; startDate: string; endDate: string; weeks: string | number; price?: string | number; }
interface BatchRaw {
  _id: string;
  name: string;
  title?: string;
  days: string;
  dayOfWeek?: string;
  multiDays?: string[];
  timing: string;
  timeSlots?: TimeSlot[];
  fee: number;
  price?: number;
  pricePerSession?: number;
  programBasePrice?: number;
  seats: number;
  maxCapacity?: number;
  sessionsPerWeek?: number;
  monthOptions?: MonthOption[];
  location?: { title?: string; city?: string; address?: string };
  groundLocationNote?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function getDayLabel(batch: BatchRaw): string {
  if (batch.dayOfWeek === "MULTI" && batch.multiDays && batch.multiDays.length > 0)
    return batch.multiDays.map((d) => DAY_FULL[d] ?? d).join(" / ");
  if (batch.dayOfWeek && batch.dayOfWeek !== "MULTI") return DAY_FULL[batch.dayOfWeek] ?? batch.dayOfWeek;
  return batch.days ?? "";
}

function buildDaySlotOptions(batch: BatchRaw): string[] {
  const slots = getSlots(batch);
  const location = getLocationStr(batch);
  const locationSuffix = location ? ` - ${location}` : "";

  let days: string[] = [];
  if (batch.multiDays && batch.multiDays.length > 0) {
    days = batch.multiDays.map((d) => DAY_FULL[d] ?? d);
  } else if (batch.dayOfWeek && batch.dayOfWeek !== "MULTI") {
    days = [DAY_FULL[batch.dayOfWeek] ?? batch.dayOfWeek];
  } else if (batch.days) {
    days = [batch.days];
  }

  if (days.length === 0) return [];

  return days.map((day) => {
    if (slots.length > 0) {
      const s = slots[0];
      return `${day} - ${fmt12(s.startTime)} - ${fmt12(s.endTime)}${locationSuffix}`;
    }
    return `${day}${locationSuffix}`;
  });
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

// Formats a month option's start/end dates + weeks as "Jul 5 - Aug 10 ( 5 week )"
function fmtMonthDateRange(startDate?: string, endDate?: string, weeks?: string | number): string {
  if (!startDate || !endDate) return "";
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const range = `${s.toLocaleDateString("en-US", opts)} - ${e.toLocaleDateString("en-US", opts)}`;
  return weeks ? `${range} ( ${weeks} week )` : range;
}

function getPricePerSession(batch: BatchRaw): number {
  return batch.pricePerSession ?? batch.price ?? batch.fee ?? 0;
}

function freqLabel(n: number): string {
  const m: Record<number, string> = { 1: "Once a Week", 2: "Twice a Week", 3: "Thrice a Week" };
  return m[n] ?? `${n}× a Week`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ProgramSelection() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { setSelectedBatch, setSelectedProgram, students, updateStudent, addStudent, removeStudent, currentStudentIndex, setCurrentStudentIndex, selectedBatch } =
    useRegistration();

  const [searchParams] = useSearchParams();
  const isNewChild = searchParams.get("newChild") === "true";
  const isEditingProgram = searchParams.get("editProgram") === "true";

  const [program, setProgram] = useState<Program | null>(null);
  const [batches, setBatches] = useState<BatchRaw[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<MonthOption | null>(null);
  const [selectedFreq, setSelectedFreq] = useState<number>(1);
  const [daySlots, setDaySlots] = useState<(string | null)[]>([null]);

  // ── WEEKLY batchType: multi-select batches, price = basePrice × count ──
  const [weeklyBatches, setWeeklyBatches] = useState<WeeklyBatchRaw[]>([]);
  const [selectedWeeklyBatchIds, setSelectedWeeklyBatchIds] = useState<string[]>([]);
  const isWeeklyProgram = program?.batchType === "WEEKLY";

  // ── Student form state (inline, replaces /student-details page) ──
  const [batchConfirmed, setBatchConfirmed] = useState(false);
  const studentFormRef = useRef<HTMLDivElement>(null);
  const [dobError, setDobError] = useState<string>("");

  useEffect(() => {
    const fetchProgram = async () => {
      if (!id) return;
      try {
        const data = await getProgramById(id);
        const batchItems: BatchRaw[] = Array.isArray(data?.batches)
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
              programBasePrice: Number(b.programBasePrice ?? b.basePrice ?? b.pricePerSession ?? b.price ?? b.fee ?? 0),
              seats: Number(b.maxCapacity ?? b.capacity ?? b.seats ?? 0),
              sessionsPerWeek: b.sessionsPerWeek ?? undefined,
              monthOptions: Array.isArray(b.monthOptions) ? b.monthOptions : [],
              location: b.location,
              groundLocationNote: b.groundLocationNote,
            }))
          : [];
        setProgram(data ?? null);
        setBatches(batchItems);
        setWeeklyBatches(Array.isArray(data?.weeklyBatches) ? data.weeklyBatches : []);
        setSelectedProgram(data ?? null);
        // Always default to once a week; user can select more
        setSelectedFreq(1);
      } catch {
        setProgram(null); setBatches([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProgram();
  }, [id, setSelectedProgram]);

  useEffect(() => {
    if (batchConfirmed && selectedBatch?.days) return;
    setDaySlots(Array(selectedFreq).fill(null));
  }, [batchConfirmed, selectedBatch, selectedFreq]);

  useEffect(() => {
    if (!selectedBatch || batches.length === 0 || selectedBatchId || batchConfirmed) return;
    const savedBatch = batches.find((batch) => batch._id === selectedBatch._id);
    if (!savedBatch) return;

    const savedMonth = (selectedBatch as any).selectedMonth ?? {
      label: selectedBatch.name,
      startDate: "",
      endDate: "",
      weeks: "",
      price: selectedBatch.fee,
    };
    const savedFrequency = Number((selectedBatch as any).selectedFrequency ?? selectedBatch.sessionsPerWeek ?? 1);
    const savedDays = selectedBatch.days ? selectedBatch.days.split(" + ") : [];

    setSelectedBatchId(savedBatch._id);
    setSelectedMonth(savedMonth);
    setSelectedFreq(savedFrequency);
    setDaySlots(savedDays.length > 0 ? savedDays : Array(savedFrequency).fill(null));
    updateStudent(currentStudentIndex, { selectedBatch });
    setBatchConfirmed(!isEditingProgram);
  }, [batchConfirmed, batches, currentStudentIndex, isEditingProgram, selectedBatch, selectedBatchId, updateStudent]);

  useEffect(() => {
    if (!isEditingProgram || !selectedBatch || !Array.isArray((selectedBatch as any).selectedWeeklyBatches)) return;
    const ids = (selectedBatch as any).selectedWeeklyBatches
      .map((batch: any) => batch.batchId || batch._id)
      .filter(Boolean);
    if (ids.length) {
      setSelectedWeeklyBatchIds(ids);
      setBatchConfirmed(false);
    }
  }, [isEditingProgram, selectedBatch]);

  const activeBatch = batches.find((b) => b._id === selectedBatchId) ?? null;
  const pricePerSession = activeBatch ? getPricePerSession(activeBatch) : 0;

  // baseMonthPrice = admin-entered price for the selected month option (= "once a week" price).
  // Cross-reference from activeBatch.monthOptions in case selectedMonth object lost its price.
  const baseMonthPrice = (() => {
    if (!selectedMonth) return 0;
    // First try: price on the selectedMonth object itself
    const direct = Number(selectedMonth.price);
    if (direct > 0) return direct;
    // Second try: find the matching option in activeBatch.monthOptions by label
    const match = activeBatch?.monthOptions?.find((m: any) => m.label === selectedMonth.label);
    const fromBatch = Number((match as any)?.price);
    if (fromBatch > 0) return fromBatch;
    return 0;
  })();
  // totalPrice = base price × selected frequency (once/twice/thrice etc. per week)
  const totalPrice = baseMonthPrice > 0 ? baseMonthPrice * selectedFreq : 0;

  // ── WEEKLY batchType: price = program basePrice × number of batches picked ──
  const weeklyBasePrice = program?.discountedPrice ?? program?.basePrice ?? 0;
  const weeklyTotalPrice = calcWeeklyPrice(weeklyBasePrice, selectedWeeklyBatchIds);

  const monthOpts: MonthOption[] = activeBatch?.monthOptions ?? [];
  const maxFreq = activeBatch?.sessionsPerWeek ?? 3;

  const allDaySlotsSelected = daySlots.every((s) => s !== null);
  const canConfirm = isWeeklyProgram
    ? selectedWeeklyBatchIds.length > 0
    : Boolean(activeBatch) && Boolean(selectedMonth) && allDaySlotsSelected;

  const buildBatchContext = () => {
    if (isWeeklyProgram) {
      if (selectedWeeklyBatchIds.length === 0) return null;
      const snapshots = toWeeklyBatchSnapshots(weeklyBatches, selectedWeeklyBatchIds);
      const weeklyBatchName = snapshots.map((s) => s.label).filter(Boolean).join(" + ");
      return {
        _id: program?._id,
        name: weeklyBatchName || "Selected weekly batches",
        days: snapshots.map((s) => s.label).join(" + "),
        timing: snapshots.map((s) => `${s.startTime} - ${s.endTime}`).join(" | "),
        fee: weeklyTotalPrice,
        seats: program?.maxCapacity ?? 0,
        sessionsPerWeek: selectedWeeklyBatchIds.length,
        selectedWeeklyBatches: snapshots,
      };
    }
    if (!activeBatch || !selectedMonth) return null;
    return {
      _id: activeBatch._id,
      name: activeBatch.name,
      days: daySlots.filter(Boolean).join(" + "),
      timing: daySlots.filter(Boolean).join(" | "),
      fee: totalPrice,
      seats: activeBatch.seats,
      sessionsPerWeek: selectedFreq,
      selectedMonth,
      selectedFrequency: selectedFreq,
    };
  };

  const handleConfirm = () => {
    const batchForContext = buildBatchContext();
    if (!batchForContext) return;
    setSelectedBatch(batchForContext as any);
    if (isNewChild) {
      addStudent({ firstName: "", lastName: "", dob: "", gender: "", schoolName: "", medicalNotes: "", selectedBatch: batchForContext as any });
      setCurrentStudentIndex(students.length);
    } else {
      updateStudent(currentStudentIndex, { selectedBatch: batchForContext as any });
    }
    setBatchConfirmed(true);
    setTimeout(() => studentFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const student = students[currentStudentIndex] ?? students[0];

  const isStudentValid = Boolean(
    student?.firstName?.trim() &&
    student?.lastName?.trim() &&
    student?.dob &&
    !dobError &&
    student?.gender
  );

  const handleStudentChange = (field: string, value: string) => {
    updateStudent(currentStudentIndex, { [field]: value });
  };

  const handleDobChange = (value: string) => {
    handleStudentChange("dob", value);
    setDobError(getDobError(value));
  };

  const handleAddAnotherStudent = () => {
    if (!isStudentValid) return;
    const batchCtx = buildBatchContext() ?? students[currentStudentIndex]?.selectedBatch ?? selectedBatch;
    addStudent({ firstName: "", lastName: "", dob: "", gender: "", schoolName: "", medicalNotes: "", selectedBatch: batchCtx as any });
    setCurrentStudentIndex(students.length);
    setDobError("");
    setTimeout(() => studentFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const handleProceedToReview = () => {
    if (!isStudentValid) return;
    navigate("/review-order");
  };

  // ─── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="h-20" />
        <main
          className="min-h-screen flex items-center justify-center"
          style={{ background: "linear-gradient(145deg, #F3EFE2 0%, #ECE6D4 35%, #FBF8EF 70%, #F3EFE2 100%)" }}
        >
          <div className="flex flex-col items-center gap-3">
            <span
              className="h-8 w-8 rounded-full border-[3px] border-[var(--pitch-deep)] animate-spin"
              style={{ borderTopColor: "var(--gold)" }}
            />
            <p className="text-sm font-medium" style={{ color: "var(--ink-500)" }}>
              Warming up the pitch…
            </p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // ─── Not found state ──────────────────────────────────────────────────────────
  if (!program) {
    return (
      <>
        <Navbar />
        <div className="h-20" />
        <main
          className="min-h-screen flex items-center justify-center"
          style={{ background: "linear-gradient(145deg, #F3EFE2 0%, #ECE6D4 35%, #FBF8EF 70%, #F3EFE2 100%)" }}
        >
          <div
            className="rounded-[20px] bg-white px-8 py-6 text-center shadow-[var(--shadow-card)]"
            style={{ border: "1px solid var(--pitch-deep)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--leather)" }}>
              Program not found.
            </p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const programTitle =
    `${program.ageGroups?.[0] ?? ""} - ${program.skillLevels?.[0] ?? ""} - ${
      typeof program.location === "string" ? program.location : program.location?.title ?? ""
    }`.replace(/^[ -]+|[ -]+$/g, "");

  // ─── Main render ──────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar />
      <div className="h-20" />
      <main
        className="min-h-screen"
        style={{
          background: "linear-gradient(145deg, #F3EFE2 0%, #ECE6D4 35%, #FBF8EF 70%, #F3EFE2 100%)",
          color: "var(--outfield)",
        }}
      >
        {/* ── Welcome banner ── */}
        <div className="max-w-4xl mx-auto px-4 pt-10">
          <button
            type="button"
            onClick={() => navigate(`/programs/${id}`)}
            className="inline-flex items-center gap-2 text-sm font-semibold transition hover:opacity-80"
            style={{ color: "var(--ink-500)" }}
          >
            <HiOutlineArrowLeft className="h-4 w-4" />
            Back to program
          </button>

          <div className="mt-6 flex flex-col gap-2">
            <span className="scoreboard-label">
              <span aria-hidden>🏏</span> Welcome to Registration
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold leading-tight" style={{ color: "var(--outfield)" }}>
              Lock in your spot at the crease
            </h1>
            <p className="text-sm sm:text-base max-w-xl" style={{ color: "var(--ink-500)" }}>
              Pick your batch, choose your training days, and step up to register — it only takes a minute.
            </p>
          </div>

          <div className="seam-divider mt-6 mb-2" />
        </div>

        {/* ── Batch Cards ── */}
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {isWeeklyProgram ? (
            <div className="program-card relative overflow-hidden">
              <div className="p-5 pb-3">
                <h2 className="font-display text-lg font-semibold" style={{ color: "var(--outfield)" }}>
                  {programTitle || program.title}
                </h2>
                <p className="mt-1 text-sm" style={{ color: "var(--ink-500)" }}>
                  This is a Weekly program — select one or more batches below. Price = base price × number
                  of batches selected.
                </p>
              </div>
              <div className="px-5 pb-5">
                <WeeklyBatchSelector
                  batches={weeklyBatches}
                  basePrice={weeklyBasePrice}
                  selectedIds={selectedWeeklyBatchIds}
                  onChange={setSelectedWeeklyBatchIds}
                />
              </div>
              {selectedWeeklyBatchIds.length > 0 && (
                <div
                  className="px-5 py-4 flex items-center justify-between"
                  style={{ borderTop: "1px solid var(--pitch-deep)" }}
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--ink-400)" }}>
                      Registration Price
                    </p>
                    <p className="text-3xl font-bold mt-0.5" style={{ color: "var(--outfield)" }}>
                      ${weeklyTotalPrice}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canConfirm}
                    onClick={handleConfirm}
                    className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: "linear-gradient(135deg, var(--gold), var(--gold-light))",
                      color: "var(--outfield)",
                      boxShadow: "var(--shadow-gold)",
                    }}
                  >
                    Register Now <HiOutlineArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
          {batches.length === 0 && (
            <div
              className="rounded-[20px] bg-white p-10 text-center text-sm"
              style={{ border: "1px solid var(--pitch-deep)", color: "var(--ink-400)" }}
            >
              No batches available for this program.
            </div>
          )}

          {batches.map((batch) => {
            const isSelected = selectedBatchId === batch._id;
            const pps = getPricePerSession(batch);
            const bMonthOpts = batch.monthOptions ?? [];
            const bMaxFreq = batch.sessionsPerWeek ?? 3;
            const bFreqOpts = Array.from({ length: bMaxFreq }, (_, i) => i + 1);

            return (
              <div
                key={batch._id}
                className="program-card relative overflow-hidden"
                style={
                  isSelected
                    ? { borderColor: "var(--gold)", boxShadow: "var(--shadow-gold)" }
                    : undefined
                }
              >
                {isSelected && (
                  <div
                    className="absolute top-0 left-0 right-0 h-[3px]"
                    style={{ background: "linear-gradient(90deg, var(--gold), var(--gold-light))" }}
                  />
                )}

                {/* Card header */}
                <div className="flex items-start justify-between p-5 pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-display text-lg font-semibold" style={{ color: "var(--outfield)" }}>
                        {programTitle || batch.name}
                      </h2>
                      {batch.name && (
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ background: "var(--pitch-soft)", color: "var(--ink-500)" }}
                        >
                          {batch.name}
                        </span>
                      )}
                    </div>
                    {bMonthOpts.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {bMonthOpts.map((m, mi) => (
                          <p key={mi} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--ink-500)" }}>
                            <span aria-hidden>📅</span>
                            {m.label} {m.startDate ? `Starts – ${new Date(m.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-2xl font-bold" style={{ color: "var(--leather)" }}>
                      {(() => {
                        const baseP = batch.programBasePrice ?? pps;
                        // A month is selected for THIS batch — show the live computed total.
                        if (isSelected && selectedMonth && totalPrice > 0) {
                          return `$${totalPrice}`;
                        }
                        // No month chosen yet (regardless of selection) — always show
                        // the program's base price, not the lowest month option.
                        return baseP > 0 ? `$${baseP}` : "$—";
                      })()}
                    </p>
                  </div>
                </div>

                <div className="px-5 py-4 space-y-5" style={{ borderTop: "1px solid var(--pitch-deep)" }}>
                  {/* Select Month(s) */}
                  {bMonthOpts.length > 0 && (
                    <div>
                      <p className="scoreboard-label !pb-1 !border-b-0">Select Month(s)</p>
                      <div className="flex flex-wrap gap-3 mt-2">
                        {bMonthOpts.map((opt, oi) => {
                          const isChecked = isSelected && selectedMonth?.label === opt.label;
                          const dateRange = fmtMonthDateRange(opt.startDate, opt.endDate, opt.weeks);
                          return (
                            <label
                              key={oi}
                              className="flex items-center gap-2 cursor-pointer text-sm"
                              style={{ color: "var(--outfield)" }}
                            >
                              <input
                                type="radio"
                                name={`month-${batch._id}`}
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedBatchId(batch._id);
                                  setSelectedMonth(opt);
                                  setSelectedFreq(1); // default once a week
                                }}
                                className="w-4 h-4"
                                style={{ accentColor: "var(--gold)" }}
                              />
                              <span className="flex flex-col leading-tight">
                                <span>{opt.label}{opt.price ? ` · $${opt.price}` : ""}</span>
                                {dateRange && (
                                  <span className="text-xs font-normal" style={{ color: "var(--ink-400)" }}>
                                    {dateRange}
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* If no month options, just a "Select" radio */}
                  {bMonthOpts.length === 0 && (
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "var(--outfield)" }}>
                        <input
                          type="radio"
                          name={`batch-select-${batch._id}`}
                          checked={isSelected}
                          onChange={() => {
                            setSelectedBatchId(batch._id);
                            setSelectedMonth({ label: batch.name, startDate: "", endDate: "", weeks: "" });
                            setSelectedFreq(1); // default once a week
                          }}
                          className="w-4 h-4"
                          style={{ accentColor: "var(--gold)" }}
                        />
                        Select this batch
                      </label>
                    </div>
                  )}

                  {/* Batch Frequency — only shown when this batch is selected */}
                  {isSelected && (
                    <>
                      <div>
                        <p className="scoreboard-label !pb-1 !border-b-0">Batch Frequency</p>
                        <div className="flex flex-wrap gap-4 mt-2">
                          {bFreqOpts.map((n) => (
                            <label key={n} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "var(--outfield)" }}>
                              <input
                                type="radio"
                                name={`freq-${batch._id}`}
                                checked={selectedFreq === n}
                                onChange={() => setSelectedFreq(n)}
                                className="w-4 h-4"
                                style={{ accentColor: "var(--gold)" }}
                              />
                              {freqLabel(n)}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="seam-divider" />

                      {/* Select Day Batch(s) */}
                      <div>
                        <p className="scoreboard-label !pb-1 !border-b-0 mb-3">Select Day Batch(s)</p>
                        <div className="space-y-3">
                          {Array.from({ length: selectedFreq }).map((_, di) => {
                            const dayLabel = di === 0 ? "Select Day 1 Batch" : `Select Day ${di + 1} Batch`;
                            return (
                              <select
                                key={di}
                                value={daySlots[di] ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value || null;
                                  setDaySlots((prev) => {
                                    const next = [...prev];
                                    next[di] = val;
                                    return next;
                                  });
                                }}
                                className="w-full rounded-lg px-4 py-3 text-sm bg-white shadow-sm appearance-none cursor-pointer focus:outline-none transition"
                                style={{
                                  color: "var(--outfield)",
                                  border: `1.5px solid ${daySlots[di] ? "var(--gold)" : "var(--pitch-deep)"}`,
                                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B6753'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                  backgroundRepeat: "no-repeat",
                                  backgroundPosition: "right 12px center",
                                  backgroundSize: "16px",
                                  paddingRight: "40px",
                                }}
                              >
                                <option value="">{dayLabel}</option>
                                {buildDaySlotOptions(batch)
                                  .filter(
                                    (opt) =>
                                      opt === daySlots[di] ||
                                      !daySlots.some((selected, si) => si !== di && selected === opt)
                                  )
                                  .map((opt, oi) => (
                                    <option key={oi} value={opt}>{opt}</option>
                                  ))}
                              </select>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Price + Register */}
                {isSelected && (
                  <div
                    className="px-5 py-4 flex items-center justify-between"
                    style={{ borderTop: "1px solid var(--pitch-deep)" }}
                  >
                    <div>
                      <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--ink-400)" }}>
                        Registration Price
                      </p>
                      <p className="text-3xl font-bold mt-0.5" style={{ color: "var(--outfield)" }}>
                        {totalPrice > 0 ? `$${totalPrice}` : "$—"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!canConfirm}
                      onClick={handleConfirm}
                      className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: "linear-gradient(135deg, var(--gold), var(--gold-light))",
                        color: "var(--outfield)",
                        boxShadow: "var(--shadow-gold)",
                      }}
                    >
                      Register Now <HiOutlineArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
            </>
          )}

          {/* ── Inline Student Details Form (shown after batch confirmed) ── */}
          {batchConfirmed && student && (
            <div ref={studentFormRef} className="mt-6 space-y-5">
              {/* Header */}
              <div className="rounded-[20px] p-5" style={{ background: "var(--gold-glow)", border: "1px solid var(--gold-light)" }}>
                <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--ink-400)" }}>
                  Step 2 — Student Details
                </p>
                <h2 className="mt-1 text-xl font-bold" style={{ color: "var(--outfield)" }}>
                  Student {currentStudentIndex + 1}{students.length > 1 ? ` of ${students.length}` : ""}
                </h2>
                <p className="mt-0.5 text-sm" style={{ color: "var(--ink-500)" }}>
                  Fill in the details below — all fields marked * are required.
                </p>
                {/* Student tabs if multiple */}
                {students.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {students.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setCurrentStudentIndex(i); setDobError(""); }}
                        className="h-8 w-8 rounded-full border text-xs font-bold transition"
                        style={{
                          background: i === currentStudentIndex ? "var(--gold)" : "white",
                          color: i === currentStudentIndex ? "var(--outfield)" : "var(--ink-400)",
                          borderColor: i === currentStudentIndex ? "var(--gold)" : "var(--pitch-deep)",
                        }}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { removeStudent(currentStudentIndex); setCurrentStudentIndex(Math.max(0, currentStudentIndex - 1)); setDobError(""); }}
                      className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition"
                      style={{ borderColor: "rgba(239,68,68,0.4)", color: "#ef4444", background: "rgba(239,68,68,0.06)" }}
                    >
                      <HiOutlineTrash className="h-3 w-3" /> Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Form card */}
              <div className="rounded-[20px] p-6 space-y-4" style={{ background: "white", border: "1px solid var(--pitch-deep)" }}>
                {/* First + Last name */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--ink-400)" }}>
                      First Name <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={student.firstName}
                      onChange={(e) => handleStudentChange("firstName", e.target.value)}
                      placeholder="Alex"
                      className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition"
                      style={{ borderColor: "var(--pitch-deep)", background: "#fafaf8", color: "var(--outfield)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--ink-400)" }}>
                      Last Name <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={student.lastName}
                      onChange={(e) => handleStudentChange("lastName", e.target.value)}
                      placeholder="Patel"
                      className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition"
                      style={{ borderColor: "var(--pitch-deep)", background: "#fafaf8", color: "var(--outfield)" }}
                    />
                  </div>
                </div>

                {/* DOB + Gender */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--ink-400)" }}>
                      Date of Birth <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={student.dob}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => handleDobChange(e.target.value)}
                      className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition"
                      style={{ borderColor: dobError ? "#ef4444" : "var(--pitch-deep)", background: "#fafaf8", color: "var(--outfield)" }}
                    />
                    {dobError && <p className="mt-1 text-xs font-semibold" style={{ color: "#ef4444" }}>{dobError}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--ink-400)" }}>
                      Gender <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <GenderSelect
                      value={student.gender}
                      onChange={(value) => handleStudentChange("gender", value)}
                      className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition"
                      style={{ borderColor: "var(--pitch-deep)", background: "#fafaf8", color: "var(--outfield)" }}
                    />
                  </div>
                </div>

                {/* School */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--ink-400)" }}>
                    School Name
                  </label>
                  <input
                    type="text"
                    value={student.schoolName}
                    onChange={(e) => handleStudentChange("schoolName", e.target.value)}
                    placeholder="Sunrise High School"
                    className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition"
                    style={{ borderColor: "var(--pitch-deep)", background: "#fafaf8", color: "var(--outfield)" }}
                  />
                </div>

                {/* Medical Notes */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--ink-400)" }}>
                    Medical Notes
                  </label>
                  <textarea
                    rows={3}
                    value={student.medicalNotes}
                    onChange={(e) => handleStudentChange("medicalNotes", e.target.value)}
                    placeholder="Allergies or important health info..."
                    className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition resize-none"
                    style={{ borderColor: "var(--pitch-deep)", background: "#fafaf8", color: "var(--outfield)" }}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between pb-10">
                <button
                  type="button"
                  onClick={handleAddAnotherStudent}
                  disabled={!isStudentValid}
                  className="inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ borderColor: "var(--gold)", color: "var(--outfield)", background: "var(--gold-glow)" }}
                >
                  <HiOutlinePlusCircle className="h-4 w-4" />
                  + Add Another Student (Same Batch)
                </button>
                <button
                  type="button"
                  onClick={handleProceedToReview}
                  disabled={!isStudentValid}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, var(--gold), var(--gold-light))",
                    color: "var(--outfield)",
                    boxShadow: "var(--shadow-gold)",
                  }}
                >
                  Continue to Review <HiOutlineArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
